
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

	var parent = params.parentRef;

	//console.log("POST-comp-parent", parent);
    var self = this;
    var recentNtfTimestamp = 0;
    var POST_NTF_NUMBER_KEY = "ts-post-ntf-number";
    var MAX_NTF_SHOWN = constants.MAX_NOTIFICATIONS_SHOWN;

    var notificationWrapper = $("#notifications .dropdown-wrapper");
    // model for post notifications
    function PostNotification(n){
		var self = this;

		self.notificationText = helper.getPostNotificationText(n)
		self.postId = n.post_id;
		self.groupId = n.group_id;
		self.groupName = n.group_name;
		self.posterName = n.poster_name;
		self.posterImage = helper.getImageURL(n.poster_image, constants.NOTIFICATION_IMAGE, "user");
		self.timestamp = n.timestamp;
		self.timestampText = helper.getTimestampText(n.timestamp, true);
	};

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
					console.log("currentGroupId", currentGroupId);
				}

				var latestPost;
				var	latestPostId;

				if ( parent && self.feed() ){
					latestPost = self.feed()[0]
					//in case of empty array
					if (latestPost) {
						latestPostId = latestPost.post_id;
						console.log("latestPost", latestPost);
					}		
				}
				
				/* n inside the function is still modeled as the object from server,
				   so use server side(python) property names */
				var ntfProcessed = $.map(notifications, function(n, i){
					/*raise new post flag only if
						>> there is an unread notification about current group
						>> notification is of type "post"
						>> we have a post in the feed
						>> notification is about a post that is not in the current group feed
					*/
					console.log(n.group_id === currentGroupId);
					console.log(n["type"] === "post");
					console.log(latestPostId);

					console.log(n.post_id !== latestPostId);

					console.log(latestPost.user_id !== self.user["id"]);
					console.log("-------------------------");

					if( (n.group_id === currentGroupId) &&
						(n["type"] === "post") &&
						(latestPostId) &&
						(n.post_id !== latestPostId))
					{	
						//for the bug when user posts itself in group without checking any pending notf
						if (latestPost.user_id !== self.user["id"]){
							self.newFeedFlag(true); 
						}
					}// end if

					return new PostNotification(n);
				});

				//update most recently fetched timestamp
				recentNtfTimestamp = ntfProcessed[0].timestamp;
				
				var showNotifications = ntfProcessed;
				//existingNtf holds current notifications
				if(existingNtf) {
					//update timestampText on existing notifications
					for (var i=0, l=existingNtf.length; i<l; i++) {
						existingNtf[i].timestampText = helper.getTimestampText(existingNtf[i].timestamp);
					}
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
				console.log("Something went wrong while fetching post NOTIFICATIONS");
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
		var result = true;
		if (postArray.length === 0){
			return true
		}

		for (var i=0, len1 = ntfArray.length; i<len1; i++){
			
			var test = false;
			if (ntfArray[i].group_id !== currentGroup || ntfArray[i]["type"] !== "post"){
				continue;
			}

			for (var j=0, len2 = postArray.length; j<len2; j++){
				
				var ntfTimestamp = parseInt(ntfArray[i].timestamp, 10);
				var postTimestamp = parseInt(postArray[j].created, 10);
				
				if ((ntfArray[i].post_id !== postArray[j].post_id) &&
					(ntfTimestamp > postTimestamp))
				{
					test = true;
					break;
				}// end if

			}// end inner postArray loop

			if (test){
				result = true;
				break;
			}
		}// end outer ntfArray

		return result;
	}

}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: PostNotificationViewModel, template: htmlString };

});