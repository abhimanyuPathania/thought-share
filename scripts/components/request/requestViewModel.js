
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/request/requestTemplate.html'], 

function(ko, $, helper, constants, htmlString) {

function RequestViewModel(params) {
	
var self = this;

var userProfileViewModelRef = null; // reference to userProfileViewModel
if (params.parentRef && params.parentRef.userProfileViewModel){
	userProfileViewModelRef = params.parentRef;
}

var REQUEST_NTF_KEY = "ts-req-ntf-timestamp"; 
var requestWrapper = $("#requests .dropdown-wrapper");

self.pollingTimestamp = null;
self.fetchTimestamp = null;

self.requestNotifications = ko.observableArray();
self.unreadRequestNotifications = ko.observable();
if (userProfileViewModelRef) {
	// set the reference to requestNotifications observable to parent userProfileViewModel's
	// requestComponentObArray property.
	userProfileViewModelRef.requestComponentObsArray = self.requestNotifications;

	// get the reference to userProfileViewModel's observable array holding requests
	self.userProfileRequests = userProfileViewModelRef.requests.requestArray;

	/*
		userProfileViewModel has refernce to request components requests observable array and
		RequestViewModel has reference to userProfileViewModel's requests observable array.
	*/
}

self.stopPolling = false;

initialFetch();

self.showRequests = function() {
	helper.toggleDropdown(requestWrapper);
	fetchRequestUpdates();
}


self.completeRequest = function(req, event) {

	var requestAcceptButton = $(event.target);
	var requestControlDiv = requestAcceptButton.closest('.request-control');
	var spinnerHTML = "<i class='spinner icon-spin3 animate-spin'></i>";
	var checkIconHTML = "<i class='material-icons request-checked-icon'>check_circle</i>";

	// req is the request object
	$.ajax({
		url:"/ajax/complete-request",
		type: "POST",
		dataType: "json",
		data: {"request_hash": req.request_hash},

		beforeSend: function(){	

			//fade away add button
			requestAcceptButton.velocity({
				opacity: 0
			}, { 
				duration: 200,
				display: "none",

				complete: function(){
					//after fading away the add button, replace with spinner
					requestControlDiv.append(spinnerHTML);
					
					//spinner is also faded-in, its opacity is 0 via CSS
					$(".spinner", requestControlDiv).velocity({ opacity: 1 }, { 
						duration: 100
					});
				},
			});// end velocity call
			
		},

		success: function(resp) {

			// on success we just update our view and remove that notification
			if (!resp) {
				return;
			}

			var reqIndex = self.requestNotifications.indexOf(req);
			req.complete = true;
			req.text = helper.getRequestCompleteText(req);

			setTimeout(function(){
			/*
				Using setTimeout here since we use JS to inject the spinner markup.
				The selector '$(".spinner", requestControlDiv)', targeting it returns null
				without the setTimeout delay.
			*/
			//fade out spinner
				$(".spinner", requestControlDiv).velocity({opacity: 0},{
					duration: 200,
					display: "none",

					complete: function(){
						// add the checked icon
						/*
							Checked icon is added via ko's visible binding to complete property
							of the request object. It's visible after the second splice call..
						*/

						/*fade in animation of checked icon has been offset to CSS
						  since removing and req object from obsArray also removes
						  our refernce to the requestControlDiv*/
						
						// removes the req from the array
						self.requestNotifications.splice(reqIndex , 1);
						// add it back so to render with new parameters
						self.requestNotifications.splice(reqIndex , 0, req);


						// If accepted while viewing requests on profile page, 
						// remove it from the userProfileViewModel and UI
						removeRequestFromUserProfile(req);

					}, 
				});// end velocity

			}, 1500);// end setTimeout
		},

		error: function() {
			console.log("completeRequest", "ERROR");

			
			// setTimeout is used due to same reason as in complete function
			//fade away spinner
			setTimeout(function(){
				$(".spinner", requestControlDiv).velocity({
					opacity: 0
				}, { 
					duration: 200,
					display: "none",

					complete: function(){
						//after fading spinner re-insert the button
						requestControlDiv.append(requestAcceptButton);
						
						//set its opacity to 0 and fade it in
						requestAcceptButton.css("opacity", 0);
						requestAcceptButton.velocity({ opacity: 1 }, { 
							duration: 100,
							display:"auto"
						});
					},
				});// end velocity call
			}, 1500);// end setTimeout
		}

	});
}; // end complete request

function removeRequestFromUserProfile(req) {
	if (self.userProfileRequests && self.userProfileRequests().length) {
		var profileArr = self.userProfileRequests();

		// loop over profile page's requests
		for(var i=0, l=profileArr.length; i<l; i++){

			// find the request that has been accepted
			if (profileArr[i].request_hash === req.request_hash){
				
				//calling ko's splice will cause UI refresh
				self.userProfileRequests.splice(i,1);
				break;
			}
		} 
	}
}

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
			self.requestNotifications.valueHasMutated();
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