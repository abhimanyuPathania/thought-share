
// Recommended AMD module pattern for a Knockout component that:
//  - Can be referenced with just a single 'require' declaration
//  - Can be included in a bundle using the r.js optimizer
define(['knockout', 'helper', 'text!components/post/postTemplate.html'], function(ko, helper, htmlString) {

function PostNotificationViewModel(feedViewModel) {

	/*the viewmodel is actually the parent property of the passed
	  this'(self.feedPageViewModelRef = self)' property from feedViewModel*/

	//set parent to null for the component usage on non-feed pages
	var parent = feedViewModel ? feedViewModel.parent : null;

    var self = this;
    var POST_NTF_KEY = "ts-post-ntf-timestamp";
	var stopPostNotificationPoll = false;

    // model for post notifications
    function PostNotification(n){
		var self = this;

		self.notificationText = helper.getPostNotificationText(n)
		self.postId = n.post_id;
		self.groupId = n.group_id;
		self.posterImage = n.poster_image;
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

	//!!!!this function interacts heavily with ui and need to flexible to fetch even if
	//there are no notifications to fetch----------------------------------
	self.fetchPostNotification = function() {
		//set the flag
		stopPostNotificationPoll = true;
		var topPostNtfTimestamp = localStorage.getItem(POST_NTF_KEY);
		var testInt = parseInt(topPostNtfTimestamp, 10);
		var temp = self.postNotifications();

		//also check for garbage value that might be inserted from local storage
		//!testInt covers the case where we forcibly set local storage value to 0
		if (!topPostNtfTimestamp || !testInt){
			topPostNtfTimestamp = 0;
		}

		//if there is a timestamp in local storage, but we don't have any notifications
		//set topPostNtfTimestamp as 0 to get all
		if(!temp) {
			topPostNtfTimestamp = 0;
		}

		/*if we have notifications and also a valid timestamp in local storage 
		choose the bigger timestamp of both*/
		if(temp && topPostNtfTimestamp && testInt){
			topPostNtfTimestamp = Math.max(testInt, temp[0].timestamp);
		} 

		console.log("timestamp sent", topPostNtfTimestamp);
		$.ajax({
			url: "/ajax/get-post-notifications",
			type: "GET",
			dataType: "json",
			data: {"timestamp" : topPostNtfTimestamp},

			success: function(notifications){

				if (!notifications || notifications.length == 0){
					//don't do anything for null returned due to no notifications
					return false;
				}
				
				//only intialize if parent view model is present
				var currentGroupId = (parent ? self.currentGroup().id : null);
				var latestPost;
				var	latestPostId;

				if ( parent && self.feed() ){
					latestPost = self.feed()[0]
					latestPostId = latestPost.post_id;
				}
				

				// use jquery map to get array of postNotifications objects
				/* n inside the function is still modeled as the object from server,
				   so use server side(python) property names */
				var ntfProcessed = $.map(notifications, function(n, i){
					/*raise new post flag only if
						>> there is an unread notification about current group
						>> notification is of type "post"
						>> we have a post in the feed
						>> notification is about a post that is not in the current group feed
					*/
					if(n.group_id === currentGroupId && latestPostId && n.post_id !== latestPostId && n["type"] === "post"){
						
						//for the bug when user posts itself in group without checking any pending notf
						if (latestPost.user_id !== self.user["id"]){
							self.newFeedFlag(true); 
						}
					}
					return new PostNotification(n);
				});

				//update most recently fetched timestamp to local storage
				localStorage.setItem(POST_NTF_KEY, ntfProcessed[0].timestamp);

				
				//temp holds current notifications
				var temp = self.postNotifications();
				if(temp) {
					//update timestampText on existing notifications
					for (var i=0, l=temp.length; i<l; i++) {
						temp[i].timestampText = helper.getTimestampText(temp[i].timestamp);
					}

					// update the value of observables
					self.postNotifications(null);
					self.postNotifications(ntfProcessed.concat(temp));
				} else {
					self.postNotifications(ntfProcessed);
				}

				//set unread number to zero
				self.unreadPostNotifications(0);
			},

			//set local storage value to 0 in case of unseen errors,
			//this makes app fetch all notifications in the next call
			error: function(){
				localStorage.setItem(POST_NTF_KEY, 0);
				console.log("Something went wrong while fetching post NOTIFICATIONS");
			},

			complete: function() {
				//always turn on the post request polling flag
				stopPostNotificationPoll = false;
			}
		});
	};

	// get post notifications
	function doPostNotificationsPoll() {
		if (stopPostNotificationPoll){
			console.log("post polling stopped");
			return;
		}
		$.ajax({
			url: "/ajax/check-post-notifications",
			type: "GET",
			dataType: "json",
			success: function(data){
				self.unreadPostNotifications(data);
			},
			error: function(xhr, status){
				console.log(status, "happened while checking post notifications");
			},
			complete: setTimeout(doPostNotificationsPoll, 50000)
		});
	};

}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: PostNotificationViewModel, template: htmlString };

});