
/* Basic concept is to start polling for ntf as soon as component loads
> Initially; fetch notifications if there are none present in ViewModel.
> Later use timestamps to track notifications fetched.
> Number of unread notifications is correctly shown, but no more than 15 notifications
  are fetched. In case there are more than 15 unread ntfs the user should go to the seperate
  notifications tab on his profile.
> localStorage is used to keep the count of ntf over page redirects and logouts */

define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/post/postTemplate.html'],
function(ko, $, helper, constants, htmlString) {

function PostNotificationViewModel(params) {
	var parent = null; // reference to feedPageViewModel
	if (params.parentRef && params.parentRef.feedPage){
		parent = params.parentRef;
	}
	
    var self = this;
    var recentNtfTimestamp = 0;
    var POST_NTF_NUMBER_KEY = "ts-post-ntf-number";
    var MAX_NTF_SHOWN = constants.MAX_NOTIFICATIONS_SHOWN;

    var notificationWrapper = $("#notifications .dropdown-wrapper");

	// these are the references to the observables from parent(feedPageViewModel)
	if (parent) {
		self.currentGroup = parent.currentGroup;
		self.feed = parent.feed;
		self.newFeedFlag = parent.newFeedFlag;
		self.user = parent.user;
	}

	//these belong to component viewModel
	self.postNotifications = ko.observable();
	self.unreadPostNotifications = ko.observable(0);
	// every time we update unread number, also update page title
	self.unreadPostNotifications.subscribe(updatePageTitle);

	// start polling
	doPostNotificationsPoll();

	//behaviour

	//only deals with UI, and set unread notifications to 0
	self.displayNotifications = function() {
		self.unreadPostNotifications(0);
		localStorage.setItem(POST_NTF_NUMBER_KEY, 0);

		helper.toggleDropdown(notificationWrapper);
	}

	function fetchPostNotification() {

		var existingNtf = self.postNotifications();
		// force timestamp to 0 to fetch ntf if there are not any in ViewModal
		if(!existingNtf) {
			recentNtfTimestamp = 0;
		}

		$.ajax({
			url: "/ajax/get-post-notifications",
			type: "GET",
			dataType: "json",
			data: {"timestamp" : recentNtfTimestamp},

			success: function(notifications){

				if (!notifications || notifications.length === 0){
					//don't do anything for null returned due to no notifications
					return false;
				}
				
				//only intialize if parent view model is present
				var currentGroupId = null;
				if (parent && self.currentGroup()) {
					currentGroupId = self.currentGroup().id;
				}
				
				//make Array of PostNotifications object from raw server side data
				var ntfProcessed = [];
				for (var i=0, len=notifications.length; i<len; i++){
					ntfProcessed.push(new PostNotification(notifications[i])); 
				}
				
				// if parent exists then only call the newPostAvailable test
				if (parent && currentGroupId){
					
					//if newFeedFlag is already set to true then ignore
					if (!self.newFeedFlag()){
						// directly pass func call to the observable in returned value is bool
						self.newFeedFlag( newPostAvailable(self.feed(), ntfProcessed, currentGroupId) );
					}
					
				}

				//update most recently fetched timestamp
				recentNtfTimestamp = ntfProcessed[0].timestamp;
				
				var showNotifications = ntfProcessed;
				//existingNtf holds current notifications
				if(existingNtf) {
					// add current notifications behind new ones fetched
					showNotifications = ntfProcessed.concat(existingNtf);				
				}

				//reduce them to the maximum number to be shown; displaying most recent
				if (showNotifications.length > MAX_NTF_SHOWN) {
					showNotifications = showNotifications.slice(0, MAX_NTF_SHOWN)
				}

				// update View
				self.postNotifications(null);
				self.postNotifications(showNotifications);
			},

			error: function(){
				//fetch all again
				recentNtfTimestamp = 0;
				console.log("ERROR:", "fetchPostNotification");
			}

		}); //end ajax request

	}; // end fetchPostNotification

	// get post notifications
	function doPostNotificationsPoll() {

		/* the ajax resp is an obj with 'exist' and 'number props'*/
		$.ajax({
			url: "/ajax/check-post-notifications",
			type: "GET",
			dataType: "json",
			success: function(data){
				var currentNotifications = self.postNotifications();

				//no notification read/unread exist
				if (!data.exist) {
					return false;
				} 

				//ntf exist, but no unread ntf present and user has current ntf
				if (data.number === 0 && currentNotifications) {
					return false;
				}

				//we have removed the cases where we don't want to fetch
				var unreadNumber = data.number;
				var old = localStorage.getItem(POST_NTF_NUMBER_KEY);
				if (old) {
					unreadNumber += parseInt(old, 10);
				}
				self.unreadPostNotifications(unreadNumber);
				localStorage.setItem(POST_NTF_NUMBER_KEY, unreadNumber);
				fetchPostNotification();
			},


			error: function(xhr, status){
				console.log(status, "happened while checking post notifications");
			},

			complete: setTimeout(doPostNotificationsPoll, constants.NOTIFICATION_POLLING)
		});
	};

	function newPostAvailable(postArray, ntfArray, currentGroup){
		var result = false;

		//for each notification fetched
		for (var i=0, len1 = ntfArray.length; i<len1; i++){
			
			var test = false;
			
			// if notification is about the current group or
			// it is not of type post, then skip it
			if ((ntfArray[i].groupId !== currentGroup) || 
				(ntfArray[i].notificationType !== "post"))
			{
				continue;
			}

			/*this is the case when no posts exist in the group and we recieve 
			  notification for that first post.
			  Also, ntf has cleared the above test for current group and type
			*/
			if (postArray.length === 0){
				test = true
			} 

			//for each notification fetched, check each post present
			//(loop won't run for 0 length, as in above case)
			for (var j=0, len2 = postArray.length; j<len2; j++){
				
				//get timestamps
				var ntfTimestamp = parseInt(ntfArray[i].timestamp, 10);
				var latestPostTimestamp = postArray[0].created;
				
				// if the notification is not about any post already present and
				// notification is newer than latest post present
				if ((ntfArray[i].postId !== postArray[j].post_id) &&
					(ntfTimestamp > latestPostTimestamp))
				{
					//set the test variable to true and break from inner loop
					test = true;
					break;
				}// end if

			}// end inner postArray loop

			// if notification tests positive than set the result to true
			// break out of outer loop
			if (test){
				result = true;
				break;
			}

		}// end outer ntfArray loop
		return result;
	};

	function updatePageTitle() {
		// to be called after updating the unreadPostNotification observable;

		var number = self.unreadPostNotifications();
		var title = $(document).prop("title");
		var pageTitle; // title without notification number
		var index = title.indexOf(")");

		if (index === -1) {
			pageTitle = title;
		} else {
			pageTitle = title.substring(index + 1);
		}

		if (number === 0) {
			$(document).prop("title", pageTitle);
		} else {
			var updatedTitle = "(" + number + ")" + " " + pageTitle;
			$(document).prop("title", updatedTitle);
		}

	}

	// model for post notifications
    function PostNotification(n){
		var self = this;

		self.notificationText = helper.getPostNotificationText(n)
		self.notificationType = n["type"];
		self.postId = n.post_id;
		self.groupId = n.group_id;
		self.groupName = n.group_name;
		self.posterName = n.poster_name;
		self.posterImage = helper.getImageURL(n.poster_image, constants.NOTIFICATION_IMAGE, "user");
		self.timestamp = n.timestamp;
		self.timestampText = helper.getTimestampText(n.timestamp, true);
	};

}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: PostNotificationViewModel, template: htmlString };

});