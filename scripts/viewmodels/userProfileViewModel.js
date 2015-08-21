//tabs refer to the sections  of user's profile 'groups', 'posts', 'notifications'
//and 'requests'

define(['knockout',
		'jquery',
		'sammy',
		'helper',
		'constants'],
function(ko, $, Sammy, helper, constants) {
   
return function userProfileViewModel() {
var self = this;

setupFormEdit();

//set parent to null for the component usage on non-feed pages
self.parentRef = self;
//view model id
self.userProfileViewModel = true;

//this observable contains reference to the navbarData in the navbarViewModel Component
self.navbarData = ko.observable();
self.userImages = {
	main: ko.pureComputed(function(){
		return helper.getImageURL(self.navbarData().imageURL(),
								  constants.USER_MAIN_IMAGE,
								  "user");
	}),

	modal: ko.pureComputed(function(){
		return helper.getImageURL(self.navbarData().imageURL(),
								  constants.USER_MODAL_IMAGE,
								  "user");
	}),
};



self.tabNames = ['Groups', 'Posts', 'Notifications', 'Requests'];
self.tab = {
	"groups" : ko.observable(false),
	"posts" : ko.observable(false),
	"notifications" : ko.observable(false),
	"requests" : ko.observable(false)
};

self.tabAction = {
	"groups" : getUserGroups,
	"posts" : getUserPosts,
	"notifications" : getUserNotifications,
	"requests" : getUserRequests
};

self.groups = {
	"allGroupsData": ko.observable(),
	"adminGroupsData": ko.observable()
};

self.posts = {
	"postArray" : ko.observableArray(),
	"more" : ko.observable(),
	"cursorString" : null
};

self.notifications = {
	"ntfArray" : ko.observableArray(),
	"more" : ko.observable(true),
	"timestamp" : 0
};

self.requests = {
	"requestArray" : ko.observableArray(),
	"more" : ko.observable(true),
	"cursorString" : null
};

self.changeTab = function(tabName) {
	location.hash = tabName.toLowerCase();
};

self.getMorePosts = function() {
	getUserPosts(true);
};

self.getMoreNotifications = function() {
	getUserNotifications(true);
};

self.getMoreRequests = function() {
	getUserRequests(true);
};

self.completeRequest = function(req) {
	// req is the request request object

	$.ajax({
		url:"/ajax/complete-request",
		type: "POST",
		dataType: "json",
		data: {"request_hash": req.request_hash},

		success: function(resp) {
			// on success we just update our view and remove that notification
			if (!resp) {
				return;
			}

			var temp = self.requests.requestArray();
			for(var i=0, l=temp.length; i<l; i++){
				if (temp[i].request_hash === req.request_hash){
					temp[i].text = ("You have accepted " + temp[i].user_name +
									"'s request");
					temp[i].complete = true; 
				}
			}

			//valueHasMutated won't work since the properties of each 
			//req are not observables themselves
			self.requests.requestArray(null);
			self.requests.requestArray(temp);
		},

		error: function() {
			console.log("completeRequest", "ERROR");
		}

	});
};

self.deletePost = function(post) {
	var confirmDelete = confirm("Do you want to delete this post?");
	if (!confirmDelete) {
		return false;
	}

	$.ajax({
		url: "/ajax/delete-post",
		type: "POST",
		dataType: "json",
		data: {"post_id" : post.post_id},

		success : function() {
			var currentPosts = self.posts.postArray();
			for (var i =0, l=currentPosts.length; i<l; i++){
				if(currentPosts[i].post_id === post.post_id) {
					self.posts.postArray.splice(i,1);
					break;
				}
			}
		},

		error: function () {
			console.log("deletePost", "ERROR");
		}
	});
};

self.deleteUserImage = function() {
	$.ajax({
		url: "/ajax/delete-image",
		type: "POST",
		dataType:"json",
		data:{"image_type": "user"},

		success: function(resp){
			if (!resp){
				return false;
			}
			self.navbarData().imageURL(null);

			$("button.simple-modal-close", editForm).triggerHandler("click");
			return;
		},

		error: function(xhr) {
			error.text("deleteUserImage", "ERROR");
			return false;
		}
	});
};

self.clearModalForm = function(obj, event) {
	var editForm = $("#editForm");
	var error = $("#error", editForm);
	
	editForm[0].reset();
	error.text("");
};
	

function getUserGroups() {
	var dataSent = {"view" : "groups"};
	//only fetch data if we don't have it on client side
	if (self.groups.allGroupsData()) {
		return ;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,
		success: function(data) {
			if (!data) {
				// user already has the data in ViewModel
				return false;
			}

			var allGroupsData = data.all_groups_data;
			var adminGroupIds = data.admin_group_ids;
			var adminGroupsData;

			if(!allGroupsData) {
				// user has not joined/created any group
				return false;
			}
			//add images
			for (var i=0, len=allGroupsData.length; i<len; i++){
				allGroupsData[i].cover_image_url = helper.getImageURL(allGroupsData[i].cover_image_url,
															constants.PROFILE_GROUP_IMAGE,
															"group");
			}

			if (adminGroupIds && adminGroupIds.length){
				//jquery's version Array.prototype.filter
				adminGroupsData = $.grep(allGroupsData, function(group){
					var groupId = group["id"];
					//jquery's version Array.prototype.indexOf
					var test = $.inArray(groupId, adminGroupIds);
					
					//only return groups who's id is present in adminGroupIds array
					return (test !== -1);
				});
			}

			//update observables
			self.groups.allGroupsData(allGroupsData);
			self.groups.adminGroupsData(adminGroupsData);
		},

		error: function() {
			console.log("getUserGroups:", "ERROR");
		}
	});
}

function getUserPosts(update) {
	var dataSent = {"view" : "posts",
					"cursor_str": null};

	// don't fetch when we are not updating and already have some posts
	//this is when user is simply switching tabs
	if (self.posts.postArray().length && !update){
		return false;
	}

	if (update){
		//if cursorString is null with the posts present, that implies
		//there are no more posts and the update button won't be rendered
		dataSent.cursor_str = self.posts.cursorString;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,

		success: function(data){
			self.posts.cursorString = data.cursor_str;
			self.posts.more(data.more);

			var postFetched = data.post_list;

			//the db returns None rather that empty list on failed queries
			if(!postFetched) {
				return false;
			}

			var currentFeed = self.posts.postArray();
			//add the timestamp text property to each post from feed
			for (var i=0, len=postFetched.length; i<len; i++) {
				//add timestampText and push on the current feed array
				postFetched[i]["timestampText"] = helper.getTimestampText(postFetched[i].created);
				currentFeed.push(postFetched[i]);
			}

			// notify UI subscribers
			self.posts.postArray.valueHasMutated();
		},

		error: function() {
			console.log("getUserPosts", "ERROR");
		}
	});
}

function getUserRequests(update) {

	var dataSent = {"view" : "requests",
					"cursor_str": null};

	if (self.requests.requestArray().length && !update){
		return false;
	}

	if (update){
		dataSent.cursor_str = self.requests.cursorString;
	}

	$.ajax({
		url: "/ajax/get-request-notifications",
		type: "GET",
		dataType: "json",
		data: dataSent,

		success: function(data){
			self.requests.cursorString = data.cursor_str;
			self.requests.more(data.more);

			var requestsFetched = data.request_list;

			//the db returns None rather that empty list on failed queries
			if(!requestsFetched) {
				return false;
			}

			var currentRequests = self.requests.requestArray();
			//add the timestamp text property to each post from feed
			for (var i=0, len=requestsFetched.length; i<len; i++) {
				//add text, user_image, timestampText and push on the current feed array
				requestsFetched[i]["text"] = helper.getRequestText(requestsFetched[i]);
				requestsFetched[i]["user_image"] = helper.getImageURL(requestsFetched[i].user_image,
														   			  constants.PROFILE_REQUEST_IMAGE,
														   			  "user");
				requestsFetched[i]["timestampText"] = helper.getTimestampText(requestsFetched[i].timestamp, true);

				currentRequests.push(requestsFetched[i]);
			}

			// notify UI subscribers
			self.requests.requestArray.valueHasMutated();
		},

		error: function() {
			console.log("getUserRequests", "ERROR");
		}
	});
}

function getUserNotifications(update){
	var dataSent = {"view" : "notifications",
					"timestamp": self.notifications.timestamp};

	if(!update && self.notifications.ntfArray().length){
		return false;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,
		success: function(data) {
			
			//notifications don't exist
			if (!data){
				self.notifications.more(false);
				return;
			}

			//we recieve empty array when we exhaust all ntfs by fetching them
			//over multiple calls
			if(data && data.length === 0) {
				//disable the button
				self.notifications.more(false);
				return;
			}

			//process the ntfs to client side model and push to the present ntfs
			var currentNotifications = self.notifications.ntfArray();
			for (var i=0, len=data.length; i<len; i++) {
				var notificationProcessed = new PostNotification(data[i]);
				currentNotifications.push(notificationProcessed);
			}

			//update the timestamp to that of the last ntf in the list
			self.notifications.timestamp = data[data.length-1].timestamp;
			self.notifications.ntfArray.valueHasMutated();
		},

		error: function() {
			console.log("getUserNotifications", "ERROR");
		}
	});
}


function setupFormEdit() {

	//defining the form validation functions in the closure setupFormEdit
	//this function is called at the beginning and sets up the event handlers
	//not using knockout's event binding here
	var editForm = $("#editForm");
	var displayNameInput = $("input[type=text]", editForm);
	var file = $("input[type=file]", editForm).prop("files");
	var error = $("#error", editForm);

	editForm.submit(submitEditForm);
	function submitEditForm(e){
		var displayName = $.trim(displayNameInput.val());
		var pattern = constants.DISPLAY_NAME_REGEX;
		var cancelSubmission = false;

		if (file.length > 1) {
			cancelSubmission = true;
			error.text("Please select only one image");
		}

		if (displayName && !pattern.test(displayName)) {
			cancelSubmission = true;
			error.text("Invalid display name");
		}

		if (file.length){
			var checkFile = helper.checkImageFile(file);
			if (!checkFile.ok) {
				error.text(checkFile.errorStr);
				cancelSubmission = true;
			}
		}

		if (!(displayName || file.length)){
			// blank submission
			cancelSubmission = true;
			error.text("Atleast enter a display name or choose an image");
		}

		if (cancelSubmission) {
			e.preventDefault();
			return false;
		}

		// send the form
		return true;
	}

}// end setupEditForm


Sammy(function() {
    this.get('#:tabSelected', function() {
    	var sammyThis = this;
        var tabSelected = sammyThis.params.tabSelected;

      	for (t in self.tab) {
			if (!self.tab.hasOwnProperty(t)) {
    			continue;
			}

			//set the observable for the tab selected by user to true and rest false
			if (t === tabSelected) {
				//since t is string for property name
				self.tab[t](true);
			} else{
				self.tab[t](false);
			}
		}

		// call the action function
		self.tabAction[tabSelected]()
    });

    this.get('/view-profile', function() {
    	//get groups by default
    	this.app.runRoute('get', "#groups");
	});
}).run();

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

}; // end view model

}); // end define function
