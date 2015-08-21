
define(['knockout', 'text!components/request/requestTemplate.html'], function(ko, htmlString) {
function RequestViewModel() {
	
	var self = this;

	self.REQUEST_NTF_KEY = "ts-req-ntf-timestamp";
    self.requestNotifications = ko.observable();
	self.unreadRequestNotifications = ko.observable(0);

	//start polling
	doRequestNotificationsPolling()

	self.updateRequestNotificationsReadStatus = function() {

		//since our req ntf are already ordered by latest
		var latestTimestamp = self.requestNotifications()[0].timestamp;

		//get and store the latest ntf timestamp
		localStorage.setItem(self.REQUEST_NTF_KEY, latestTimestamp);

		//set the unread no. to zero
		self.unreadRequestNotifications(0);
	};

	self.completeRequest = function(n) {

		// n is the request notification object
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

				//view does not get updated without destroying it
				self.requestNotifications(null);
				self.requestNotifications(temp);
			},

			error: function() {
				console.log("Function: completeRequest", "something went wrong");
			}

		});
	}; // end complete request

	//define polling function
	function doRequestNotificationsPolling() {
		$.ajax({
			url: "/ajax/get-request-notifications",
			type: "GET",
			dataType: "json",
			success: function(notifications){
				if (!notifications){
					return;
				}
				var storedTimestamp = parseInt(localStorage.getItem(self.REQUEST_NTF_KEY),10);
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
	};
} //end view model

// Return component definition, this is used in main.js
return { viewModel: RequestViewModel, template: htmlString };

});