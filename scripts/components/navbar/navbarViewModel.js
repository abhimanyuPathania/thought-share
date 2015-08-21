
define(['knockout',
		'jquery',
		'navbar',
		'helper',
		'constants',
		'libs/text!components/navbar/navbarTemplate.html'], 

function(ko, $, navbar, helper, constants, htmlString) {

function NavbarViewModel(params) {
	var parent = params.parentRef;
    var self = this;

    /*-------- POST NOTIFICATION VAR AND OBSERVABLES --------*/
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
	self.postNotifications = ko.observable();
	self.unreadPostNotifications = ko.observable(0);

	/*--------------- END POST NOTIFICATION ---------------*/

	/*-------- REQUEST VAR AND OBSERVABLES --------*/

	var REQUEST_NTF_KEY = "ts-req-ntf-timestamp"; 
	var requestWrapper = $("#requests .dropdown-wrapper");

	self.requestPollingTimestamp = null;
	self.requestFetchTimestamp = null;
	self.requestNotifications = ko.observableArray();
	self.unreadRequestNotifications = ko.observable();
	self.stopRequestPolling = false;
	
	/*--------------- END REQUEST  ---------------*/




	// start post notitications polling
	doPostNotificationsPoll();

	// fetch requests - this also kicks off request polling
	initialRequestFetch();

	//behaviour

	//only deals with UI, and set unread notifications to 0
	self.displayNotifications = function() {
		self.unreadPostNotifications(0);
		localStorage.setItem(POST_NTF_NUMBER_KEY, 0);

		navbar.toggleDropdown(notificationWrapper);
	}

	function fetchPostNotification() {

		var temp = self.postNotifications();
		// force timestamp to 0 to fetch ntf if there are not any in ViewModal
		if(!temp) {
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

				var latestPost;
				var	latestPostId;

				if ( parent && self.feed() ){
					latestPost = self.feed()[0]
					//in case of empty array
					if (latestPost) {
						latestPostId = latestPost.post_id;
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
					if(n.group_id === currentGroupId && n["type"] === "post" && latestPostId && n.post_id !== latestPostId){
						
						//for the bug when user posts itself in group without checking any pending notf
						if (latestPost.user_id !== self.user["id"]){
							self.newFeedFlag(true); 
						}
					}
					return new PostNotification(n);
				});

				//update most recently fetched timestamp
				recentNtfTimestamp = ntfProcessed[0].timestamp;
				
				var showNotifications = ntfProcessed;
				//temp holds current notifications
				if(temp) {
					//update timestampText on existing notifications
					for (var i=0, l=temp.length; i<l; i++) {
						temp[i].timestampText = helper.getTimestampText(temp[i].timestamp);
					}
					// add current notifications behind new ones fetched
					showNotifications = ntfProcessed.concat(temp);				
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



	self.showRequests = function() {
		navbar.toggleDropdown(requestWrapper);
		fetchRequestUpdates();
	}

	self.completeRequest = function(req) {

		// req is the request request object
		$.ajax({
			url:"/ajax/complete-request",
			type: "POST",
			dataType: "json",
			data: {"request_hash": req.request_hash},

			success: function(resp) {
				console.log("completeRequest", "success", resp);
				// on success we just update our view and remove that notification
				if (!resp) {
					return;
				}

				var temp = self.requestNotifications();
				for(var i=0, l=temp.length; i<l; i++){
					if (temp[i].request_hash === req.request_hash){
						temp[i].text = ("You have accepted " + temp[i].user_name +
										"'s request");
						temp[i].complete = true; 
					}
				}

				console.log(temp);
				//update View

				//valueHasMutated was not working
				self.requestNotifications(null);
				self.requestNotifications(temp);
			},

			error: function() {
				console.log("completeRequest", "ERROR");
			}

		});
	}; // end complete request

	//define polling function
	function doRequestNotificationsPolling() {

		if (self.stopRequestPolling){
			return;
		}

		//this does not send the fetch parameter
		$.ajax({
			url: "/ajax/update-request-notifications",
			type: "GET",
			dataType: "json",
			data: {"timestamp": self.requestPollingTimestamp},

			success: function(resp){
				if (!resp){
					// null when user is not admin to any group
					return;
				}
				
				if (resp.number === 0) {
					//no new requests
					return;
				}

				var reqNumber = resp.number + self.unreadRequestNotifications()
				self.requestPollingTimestamp = resp.timestamp;
				self.unreadRequestNotifications(reqNumber);
			},

			error: function() {
				console.log("doRequestNotificationsPolling", "ERROR");
			},

			
			complete: setTimeout(doRequestNotificationsPolling, constants.REQUEST_POLLING)
		});
	};

	function fetchRequestUpdates() {

		// don't fetch if nothing new and we already have something
		if (!self.unreadRequestNotifications() && self.requestNotifications().length){
			return;
		}

		//this request is only sent when there are some unread requests as 
		//informed by the polling function
		$.ajax({
			url: "/ajax/update-request-notifications",
			type: "GET",
			dataType: "json",
			data: {"timestamp": self.requestFetchTimestamp,
				   "fetch" : true},

			beforeSend : function() {
				self.stopRequestPolling = true;

				/* these are required for the first fetch after the initial fetch to keep
				   things in sync. For all later 'fetch' these will be redundant statements
				*/
				var currentRequests = self.requestNotifications()
				self.unreadRequestNotifications(0);
				if (currentRequests.length) {
					localStorage.setItem(REQUEST_NTF_KEY, currentRequests[0].timestamp);
				}
			},

			success: function(resp){
				if (!resp){
					// null when user is not admin to any group
					return;
				}
				var data = resp.request_list;
				var currentRequests = self.requestNotifications();

				if (!data) {
					// list is null for empty no requests
					return false;
				}
				//loop in reverse and add to front of existing array
				for(var i=data.length-1; i>=0; i--) {
					data[i]["text"] = helper.getRequestText(data[i]);
					data[i]["timestampText"] = helper.getTimestampText(data[i].timestamp, true);
					data[i]["user_image"] = helper.getImageURL(data[i]["user_image"],
															   constants.REQUEST_IMAGE,
															   "user");
					currentRequests.unshift(data[i]);
				}

				//Don't restrict to max 15 in dropdown menu
				//currentRequests = currentRequests.slice(0, constants.MAX_NOTIFICATIONS_SHOWN)

				self.requestFetchTimestamp = currentRequests[0].timestamp;
				localStorage.setItem(REQUEST_NTF_KEY, currentRequests[0].timestamp);

				self.unreadRequestNotifications(0);

				//here too valueHasMutated was not working
				self.requestNotifications(null);
				self.requestNotifications(currentRequests);

			},

			error: function() {
				console.log("fetchRequestUpdates", "ERROR");
			},

			complete: function () {
				self.stopRequestPolling = false;
			}
		});
	}


	// this is called only once and it sets all the observables and ViewModel properties
	// this will also call the polling function
	function initialRequestFetch() {
		// always called without sending cursor string

		$.ajax({
			url: "/ajax/get-request-notifications",
			type: "GET",
			dataType: "json",
			data: {"initial_fetch" : true},

			success: function(data){
				/* data is an object with following properties
				   'request_list', 'timestamp_list'
				 */
				if (!data.request_list){
					// not requests to start with
					self.requestPollingTimestamp = 0;
					self.requestFetchTimestamp = 0;
					self.unreadRequestNotifications(0);
					return;
				}

				var requests = data.request_list;
				var timestampList = data.timestamp_list; //array of incomplete req timestamps
				var currentRequests = self.requestNotifications();
				var initialUnread = 0;
				var storedTimestamp = localStorage.getItem(REQUEST_NTF_KEY);
				if (storedTimestamp) {
					storedTimestamp = parseInt(storedTimestamp, 10);
				}

				//we received so requests
				for (var i=0, l=requests.length; i<l; i++) {
					requests[i]["text"] = helper.getRequestText(requests[i]);
					requests[i]["timestampText"] = helper.getTimestampText(requests[i].timestamp, true);
					requests[i]["user_image"] = helper.getImageURL(requests[i]["user_image"],
															   	   constants.REQUEST_IMAGE,
															       "user");
					currentRequests.push(requests[i]);
				}

				// intialize the intialUnread variable

				/* if we have a storedTimestamp than unseen req will be the ones having
				   their timestamp greater than it*/
				if (storedTimestamp){
					for (var i=0, l=timestampList.length; i<l; i++){
						if (timestampList[i] > storedTimestamp) {
							initialUnread += 1;
						}
					}	
				} else{
					// all of them are unseen
					initialUnread = timestampList.length;
				}
				

				self.requestPollingTimestamp = currentRequests[0].timestamp;
				self.requestFetchTimestamp = currentRequests[0].timestamp;

				self.unreadRequestNotifications(initialUnread);
				self.requestNotifications.valueHasMutated();
			},

			error: function() {
				console.log("initialRequestFetch", "ERROR");
			},

			// kick off request polling after intial fetch
			complete: doRequestNotificationsPolling
		});
	}// end intial fetch

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

} //end view model

// Return component definition, this is used in main.js
return {viewModel: NavbarViewModel,
		template: htmlString,
		synchronous: true };

}); // end define