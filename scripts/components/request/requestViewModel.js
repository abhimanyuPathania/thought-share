
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/request/requestTemplate.html'], 

function(ko, $, helper, constants, htmlString) {

function RequestViewModel() {
	
var self = this;

var REQUEST_NTF_KEY = "ts-req-ntf-timestamp"; 
var requestWrapper = $("#requests .dropdown-wrapper");

self.pollingTimestamp = null;
self.fetchTimestamp = null;

self.requestNotifications = ko.observableArray();
self.unreadRequestNotifications = ko.observable();

self.stopPolling = false;

initialFetch();

self.showRequests = function() {
	helper.toggleDropdown(requestWrapper);
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

	if (self.stopPolling){
		return;
	}

	//this does not send the fetch parameter
	$.ajax({
		url: "/ajax/update-request-notifications",
		type: "GET",
		dataType: "json",
		data: {"timestamp": self.pollingTimestamp},

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
			self.pollingTimestamp = resp.timestamp;
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
		data: {"timestamp": self.fetchTimestamp,
			   "fetch" : true},

		beforeSend : function() {
			self.stopPolling = true;

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

			self.fetchTimestamp = currentRequests[0].timestamp;
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
			self.stopPolling = false;
		}
	});
}


// this is called only once and it sets all the observables and ViewModel properties
// this will also call the polling function
function initialFetch() {
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
				self.pollingTimestamp = 0;
				self.fetchTimestamp = 0;
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
			

			self.pollingTimestamp = currentRequests[0].timestamp;
			self.fetchTimestamp = currentRequests[0].timestamp;

			self.unreadRequestNotifications(initialUnread);
			self.requestNotifications.valueHasMutated();
		},

		error: function() {
			console.log("initialFetch", "ERROR");
		},

		// kick off request polling after intial fetch
		complete: doRequestNotificationsPolling
	});
}// end intial fetch


} //end view model

// Return component definition, this is used in main.js
return {viewModel: RequestViewModel,
		template: htmlString };

}); // end define