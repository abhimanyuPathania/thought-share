
define(['knockout', 'jquery', 'sammy', 'helper'], function(ko, $, Sammy, helper) {
   
return function feedPageViewModel() {

	function PostNotification(n){
		var self = this;

		self.notificationText = helper.getPostNotificationText(n)
		self.postId = n.post_id;
		self.groupId = n.group_id;
		self.posterImage = n.poster_image;
		self.timestamp = n.timestamp;
		self.timestampText = helper.getTimestampText(n.timestamp, true);
	}
	
	var POST_NTF_KEY = "ts-post-ntf-timestamp";
	var stopPostNotificationPoll = false;
	var self = this;

	//---data---//
	self.user = null;
	self.groups = ko.observable();
	self.currentGroup = ko.observable();
	self.feed = ko.observable();
	self.userPost = ko.observable();

	self.groupQueryResults = ko.observable();

	//this flag saves us from polling server to get latest posts in feed
	self.newFeedFlag = ko.observable(false);

	self.postNotifications = ko.observable();
	self.unreadPostNotifications = ko.observable(0);
	
	setGroupsAndUser();
	doPostNotificationsPoll();

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

	self.postInCurrentGroup = function() {
		if (!self.currentGroup()){
			return;
		}
		
		// use jquery's trim to check is post contains only white spaces
		// also removes extra whitespace in start/end
		var userPost = $.trim(self.userPost());
		if (!userPost){ 
			return;
		}

		$.ajax({
			url: "/ajax/post-group",
			type: "POST",
			dataType: "json",
			data: {"user_post": userPost,
				   "target_group": self.currentGroup().id
				  },
				   
			success: function (resp) {
				if (!resp){
					return;
				}
				console.log("posted in", self.currentGroup().id);
				self.userPost(null);
				setTimeout(fetchCurrentGroupFeed, 1000);
			},

			error: function(xhr) {
				console.log("something went wrong while posting in group");
				console.log("xhr.responseText", xhr.responseText);
			}
		});
	}

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
				
				var currentGroupId = self.currentGroup().id;
				var latestPost;
				var	latestPostId;
				if (self.feed()){
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


	self.queryGroups = function(data, event) {
		//initizlize static variables, happens only once
		if (!self.queryGroups.activeRequest) {
			self.queryGroups.activeRequest = false;
		}

		if (!self.queryGroups.timer){
			self.queryGroups.timer = null;
		}

		//both the checks below must happen before we test for new pattern
		
		//check for previous incomplete request and abort it
		if (self.queryGroups.activeRequest) {
			self.queryGroups.activeRequest.abort();
		}

		//clear queued request that has not been sent
		clearTimeout(self.queryGroups.timer);

		var queryString = $.trim(event.target.value);
		var pattern = /^[a-zA-Z0-9\s]{3,20}$/;
		
		if (!pattern.test(queryString)) {
			self.groupQueryResults(null);
			return false;
		}
		// if we come till here that means now we have something to query for

		//set request to query for the current queryString
		self.queryGroups.timer = setTimeout(function(){
			
			self.queryGroups.activeRequest = $.ajax({
				url: '/ajax/group-text-search',
				type: "GET",
				dataType: "json",
				data: {"q": queryString},
				success: function(data) {
					if (!data){
						return false;
					}
					console.log("Searched", data.length);
					self.groupQueryResults(data);
				},

				error: function() {
					console.log("error at group text search");
				}
			});	

		}, 800) //call after xyz milli seconds
	}

	function setGroupsAndUser() {
		console.log("setting groups and user");
		var groupJSON = $("#userGroupsJSON").attr("data-groupJSON");
		var userJSON = $("#userJSON").attr("data-userJSON");
		var groups = JSON.parse(groupJSON);
		var user = JSON.parse(userJSON);

		self.user = user;

		//return if user has joined no groups
		if(groups.length <= 0) {
			return;
		}

		//intialize observables
		self.groups(groups);
		self.currentGroup(groups[0]);
	}

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
	}

	function fetchCurrentGroupFeed() {
		console.log("fetchCurrentGroupFeed")
		$.ajax({
			url: "/ajax/get-group-feed",
			type: "GET",
			dataType: "json",
			data: {"gid": self.currentGroup().id},			
			success: function(feed){				
				if(feed === null){
					self.feed(feed);
					return;
				}

				// use jquery map to add the timestamp text property to each post from feed
				self.feed($.map(feed, function(post, i){
					post["timestamp"] = helper.getTimestampText(post.created);
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
            self.userPost(null);
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

}); // end define function
