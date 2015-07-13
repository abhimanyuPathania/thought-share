
function PostNotification(n){
	var self = this;

	self.notificationText = n.poster_name + " posted in " + n.group_name;
	self.postId = n.post_id;
	self.groupId = n.group_id;
	self.posterImage = n.poster_image;
	self.groupImage = n.group_image;
	self.timestampInSeconds = n.timestamp;
	self.timestamp = fixPostNotificationTimestamp(n.timestamp, true);

}

function FeedPageViewModel() {
	var REQUEST_NTF_KEY = "ts-req-ntf-timestamp";
	var self = this;

	//---data---//
	self.groups = ko.observable();
	self.currentGroup = ko.observable();
	self.feed = ko.observable();

	//this flag saves us from polling server to get latest posts in feed
	self.newFeedFlag = ko.observable(false);

	self.postNotifications = ko.observable();
	self.unreadPostNotifications = ko.observable(0);
	self.requestNotifications = ko.observable();
	self.unreadRequestNotifications = ko.observable(0);

	setGroups();
	doPostNotificationPolling();
	doRequestNotificationsPolling();

	//---behaviour---//
	self.updateCurrentGroup = function(group) {
		location.hash = group.id;
	}

	self.updateCurrentGroupFeed = function() {
		if (self.newFeedFlag()){
			//checking in ViewModel, but the button also won't be enabled in View
			fetchCurrentGroupFeed();
			self.newFeedFlag(false);
		}
	}

	self.updatePostNotificationsReadStatus = function(){
		var mostRecentTimestamp = self.postNotifications()[0].timestampInSeconds;
		$.ajax({
			url: "ajax/update-post-notifications-read-status",
			type: "POST",
			dataType: "json",
			data: {"timestamp": mostRecentTimestamp},
			success: function(status){
				console.log("read status updated");
				// update unread notificaitons
				self.unreadPostNotifications(0);
			},

			error: function(xhr, status){
				console.log(status, "happened while updating notification read status");
			}
		});
	}

	self.updateRequestNotificationsReadStatus = function() {
		//since our req ntf are already ordered by latest
		var latestTimestamp = self.requestNotifications()[0].timestamp;

		//get and store the latest ntf timestamp
		localStorage.setItem(REQUEST_NTF_KEY, latestTimestamp);

		//set the unread no. to zero
		self.unreadRequestNotifications(0);
	}


	self.completeRequest = function(n) {
		// n is the request notification object
		console.log("completeRequest", n.request_hash);

		$.ajax({
			url:"/ajax/complete-request",
			type: "POST",
			dataType: "json",
			data: {"request_hash": n.request_hash},

			success: function(resp) {
				// on success we just update our view and remove that notification
				if (!resp) {
					return;
				}
				
				var temp = self.requestNotifications();
				for(var i=0, l=temp.length; i<l; i++){
					if (temp[i].request_hash === n.request_hash){
						temp[i].text = ("You have accepted " + temp[i].user_name +
										"'s request");
						temp[i].complete = true; 
					}
				}

				console.log(JSON.stringify(temp));

				//view does not get updated for some reason without destroying it
				self.requestNotifications(null);
				self.requestNotifications(temp);
			},

			error: function() {
				console.log("Function: completeRequest", "something went wrong");
			}

		});
	}

	function setGroups() {
		console.log("setting groups");
		var groupJSON = $("#groupJSON").attr("data-groupJSON");
		var groups = JSON.parse(groupJSON);
		if(groups.length > 0) {
			self.groups(groups);
			self.currentGroup(groups[0]);
		}
	}

	// get post notifications
	function doPostNotificationPolling() {
		$.ajax({
			url: "/ajax/get-post-notifications",
			type: "GET",
			dataType: "json",			
			success: function(notifications){

				if (!notifications){
					//don't do anything for null returned due to no notifications
					return false;
				}
				
				var newUnread = 0;
				var currentGroupId = self.currentGroup().id;
				var latestPostId;
				if (self.feed()){
					latestPostId = self.feed()[0].post_id;
				}

				// use jquery map to get array of postNotifications objects
				/* n inside the function is still modeled as the object from server,
				   so use server side(python) property names */
				var ntfProcessed = $.map(notifications, function(n, i){
					if (!n.read){
						// increase the unread notification number
						newUnread += 1;

						/*raise new post flag only if
							>> there is an unread notification about current group
							>> we have a post in the feed
							>> notification is about a post that is not in the current group feed
						*/

						if(n.group_id === currentGroupId && latestPostId && n.post_id !== latestPostId){
							self.newFeedFlag(true); 
						}
					}

					return new PostNotification(n);
				});

				// update the value of observables
				self.unreadPostNotifications(newUnread);
				self.postNotifications(ntfProcessed);
			},
			error: function(){
				console.log("Something went wrong while fetching post NOTIFICATIONS");
			},
			complete: setTimeout(doPostNotificationPolling, 45000) //checking every 45 seconds
		});
	}

	function doRequestNotificationsPolling() {

		$.ajax({
			url: "/ajax/get-request-notifications",
			type: "GET",
			dataType: "json",
			success: function(notifications){
				
				if (!notifications){
					return;
				}
				var storedTimestamp = parseInt(localStorage.getItem(REQUEST_NTF_KEY),10);
				var unread = 0;

				for(var i=0, l = notifications.length; i < l; ++i){
					var ntfText = "";
					var n=notifications[i]; //cosmetic

					//add correct text to every req ntf
					if (n.request_type === "join") {
						ntfText = n.user_name + " is wants to join " + n.group_name;
					}
					if (n.request_type === "admin") {
						ntfText = n.user_name + " is requsting adminship of " + n.group_name;
					}
					n["text"] = ntfText;

					/*if we have a previous stored timestamp in local storage
					then increase the counter for only those notificaions whose
					 timestamp is more than that of stored one*/
					if(storedTimestamp && n.timestamp > storedTimestamp) {
						unread += 1;
					}
				}

				//if we don't have a stored timestamp than all ntf are unread
				if (!storedTimestamp) {
					unread = notifications.length;
				}

				self.requestNotifications(notifications);
				self.unreadRequestNotifications(unread);
			},

			error: function() {
				console.log("something went wrong: Request notificaitons");
			},

			//change the settimeout time!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			complete: setTimeout(doRequestNotificationsPolling, 45000)
		});
	}

	function fetchCurrentGroupFeed() {
		$.ajax({
			url: "/ajax/get-group-feed",
			type: "GET",
			dataType: "json",
			data: {"gid": self.currentGroup().id},
			//timeout: 5000,
			
			success: function(feed){				
				if(feed === null){
					self.feed(feed);
					return;
				}
				//console.log(JSON.stringify(feed[0]));
				// use jquery map to add the timestamp text property to each post from feed
				self.feed($.map(feed, function(post, i){
					post["timestamp"] = fixPostNotificationTimestamp(post.created);
					return post;
				}));
				//reset the newFeedFlag
				self.newFeedFlag(false);
			},

			error: function(){
				console.log("Something went wrong while fetching FEED");
			}
		});
	}

	 // Client-side routes    
    Sammy(function() {
        this.get('#:gid', function() {
        	var sammyThis = this;
        	//this part is just to get the group obj from the id hash...
            var group = self.groups().filter(function(grp) {
            	if (grp.id === sammyThis.params.gid) {
            		return true;
            	}
            })[0];

            self.currentGroup(group);
            fetchCurrentGroupFeed();
        });

        //route /feed to intial currentGroup
        //this also lets other routes function
        this.get('/feed', function() {
        	if (self.currentGroup()){
        		var defaultRoute = "#" + self.currentGroup().id;
        		this.app.runRoute('get', defaultRoute);
        	}
    	});
    }).run();    
}; // end view model


function fixPostNotificationTimestamp(t, ntf){
	var SECONDS_IN_DAY = 24*60*60;
	var miniMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
					  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	//set timestamps
	var now = Date.now();
	var old = parseInt(t, 10);

	var dateObjNow = new Date(now);
	var dateObjOld = new Date(old*1000);

	//use seconds diff to generate timestamp strings
	now = Math.floor(now/1000);	//convert into seconds
	var diff = now - old;
	var result,
		temp;

	if (diff < SECONDS_IN_DAY){
		if(diff <= 60){
			result = "just a moment ago";
		}

		if(diff > 60 && diff < 3600){
			temp = Math.floor(diff/60);
			result = temp + " mins";
		}

		if(diff >= 3600){
			temp = Math.floor(diff/3600);
			result = temp + " hrs";
		}

		if(temp === 1) {
			//remove the last 's' for '1 mins' or '1 hrs'
			result = result.substring(0, result.length - 1);
		}

		if(ntf && diff > 60) {
			//prepend with 'ago' for notifications timestamp
			result += " ago";
		}

	} else {
		//get local time here
		if (dateObjNow.getFullYear() === dateObjOld.getFullYear()){
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()];
		} else {
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()] + ", " + dateObjOld.getFullYear();
		}
	}
	
	return result;
}

$(document).ready(function(){
	ko.applyBindings(new FeedPageViewModel());
});
