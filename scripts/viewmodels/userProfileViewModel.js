//tabs refer to the sections of user's profile 'groups', 'posts', 'notifications' and 'requests'
//

define(['knockout',
		'jquery',
		'sammy',
		'helper',
		'constants',
		'enableForms',
		'velocity',
		'velocity-ui'],
function(ko, $, Sammy, helper, constants, enableForms, Velocity) {
   
return function userProfileViewModel() {

var self = this;

/*
	This variable is passed down and recieved by the navbar component
	as reference to userProfileViewModel.
	Also passed down to request component.

	The passdown starts from the
		<navbar-modular params="parentRef: parentRef"></navbar-modular>
	markup in base_navbar.html. Since userProfileViewModel is kicks off the page as
	defined in viewProfileMain.js
*/
self.parentRef = self;

//view model id used to indentiy is this VM by navabar and request component's VMs.
self.userProfileViewModel = true;

/*
	This property contains reference to the requestNotifications observable of the
	request component used navbar. Initialized by request component's VM.
*/
self.requestComponentObsArray  = null;

/* 
	This observable contains reference to the NavbarData obj referenced by
	self.navbarData of the navbarModViewModel. NavbarData has it own observables which
	are used to update changes.
*/
self.navbarData = ko.observable();

self.leadingImageURL = ko.pureComputed(function (){
	return helper.getImageURL(self.navbarData().imageURL(), constants.USER_LEADING_IMAGE, "user");
});

// used to track displaying leading image delete icon. Visible if there is image other than default
// for default image self.navbarData().imageURL() is null
self.imageDeleteIconStatus = ko.pureComputed(function(){
	if (self.navbarData()) {
		return self.navbarData().imageURL();
	}

	return false;
});

//jquery selections
var userEditForm = $("#editForm");
var userEditSaveButton = $(".save-user-edit");
var closeUserEditModalButton = $("div[data-modal-id = 'editUserModal'] .simple-modal-close");

var uploadModalWrapper = $(".upload-image-modal");
var deleteImageModalWrapper = $("div[data-modal-id='confirmLeadingImageDeleteModal']");
var leadingImageWrapper = $(".leading-image-wrapper");

var deletePostModalWrapper = $("div[data-modal-id='confirmPostDeleteModal']");
var deletePostModalButton = $("button.delete-post", deletePostModalWrapper);
var deletePostModalCloseButton = $(".simple-modal-close", deletePostModalWrapper);


var displayNameInputWrapper = $(".material-name-field");
var displayNameInput = $("input[type='text']", displayNameInputWrapper);
var displayNameGuide = $(".guide", displayNameInputWrapper);

var tabsDiv = $("#tabs");
var tabBar = $("#tabBar");
var tabContent = $("#tabContent");

var imageMetadata = {
	image_type: "user",
	group_id: null,
	url: constants.DEFAULT_USER_IMAGE,
	navbarDataRef: self.navbarData // not self.navbarData() because it's intialized only after
								   // the ajax request in navbar component completes
}
var checkFirstCallResult = null;


//call enable forms only after we have navbarData(after navbar_mod complete AJAX request)
//navbarData only updates once, so this function is only called once
self.navbarData.subscribe(function() {
	enableForms.setupLeadingImage(uploadModalWrapper, deleteImageModalWrapper, leadingImageWrapper, imageMetadata);
	enableForms.setupNameField(displayNameInputWrapper, "DISPLAY");
	enableForms.setupInputGuidesAndLabels(displayNameInput);
});


//register delete post events
deletePostModalButton.on("click", deletePost);


self.submitUserEdit = function(form) {
	var name = $.trim(displayNameInput.val());
	if (!constants.DISPLAY_NAME_REGEX.test(name)) {
		return false;
	}

	$.ajax({
		url: "/ajax/edit-profile",
		type: "post",
		dataType: "json",
		data: {display_name: name},

		beforeSend: function() {
			userEditSaveButton.prop("disabled", true);
		},

		success: function(resp) {
			if (!resp) {
				return;
			}
			var doc = $(document);

			//update navbar_component's displayName observable
			self.navbarData().displayName(name);

			//update the page title
			var title = doc.prop("title");
			var index = title.indexOf(")");
			if (index === -1) {
				doc.prop("title", name);
			} else {
				var number = title.substring(0, index + 1);
				var updatedTitle = number + " " + name;
				doc.prop("title", updatedTitle);
			}
			

			//close group edit modal
			//"click" also triggers modal refresh
			closeUserEditModalButton.trigger("click");
		},

		error: function() {
			console.log("ERROR:", "submitEditForm");
		}
	});
}



self.enableDisplayNameSave = function(data, event) {
	// knockout 'input' binding
	// enables/disables the 'save' button of the 'display name modal'
	// data is unused

	var name = $.trim($(event.target).val());

	if (constants.DISPLAY_NAME_REGEX.test(name)) {
		userEditSaveButton.prop("disabled", false);
	} else {
		userEditSaveButton.prop("disabled", true);
	}
}

self.userEditModalRefresh = function() {

	// clear form input
	userEditForm[0].reset();

	//reset lable
	displayNameInput.removeClass("has-value");

	//remove error and hide guide
	if (displayNameInputWrapper.hasClass("error")) {
		displayNameInputWrapper.removeClass("error");
		displayNameGuide.css("opacity", 0);
	}

	// disable save button
	userEditSaveButton.prop("disabled", true);	
}

var motionEffect = {
	right: {
		previous: "transition.slideLeftBigOut",
		current: "transition.slideRightBigIn"
	},

	left: {
		previous: "transition.slideRightBigOut",
		current: "transition.slideLeftBigIn"
	}
};

// only used to render ui, required for front-end routing
self.tabNames = ['groups', 'posts', 'notifications', 'requests'];
self.tabData = {};

self.tab = {
	groups : ko.observable(false),
	posts : ko.observable(false),
	notifications : ko.observable(false),
	requests : ko.observable(false)
};

self.tabAction = {
	groups : getUserGroups,
	posts : getUserPosts,
	notifications : getUserNotifications,
	requests : getUserRequests
};

self.groups = {
	allGroupsData: ko.observable(),
	initialFetch: false,
	filler : ko.pureComputed(function() {
		var groupsArray = self.groups.allGroupsData();
		return !(groupsArray && groupsArray.length);
	})
};


self.posts = {
	postArray : ko.observableArray(),
	more : ko.observable(),
	cursorString : null,
	deletePostData : {
		id: null,
		div: null,
	},
	enableUpdate : ko.observable(true), // obesrvable for update button's enable binding,
	initialFetch : false,
	filler: ko.pureComputed(function() {
		var postArray = self.posts.postArray();
		var more = self.posts.more();

		// Only show filler div when user does not has posts in ViewModel and
		// in datastore itself.
		return postArray.length === 0 && !more;
	})
};

self.notifications = {
	ntfArray : ko.observableArray(),
	// more for notificaitons is updated one request late. Initialize to true.
	more : ko.observable(true),
	timestamp : 0,
	enableUpdate : ko.observable(true),
	initialFetch : false,

	// this variable is used when user has no notifications at all(from initial fetch)
	filler : ko.pureComputed(function (){
		var ntfArray = self.notifications.ntfArray();
		var more = self.notifications.more();

		return ntfArray.length === 0 && !more;
	}),

	updateFiller : ko.pureComputed(function() {
		var ntfArray = self.notifications.ntfArray();
		var more = self.notifications.more();

		if (ntfArray.length && !more) {
			return true;
		} else {
			return false;
		}
	})
};

self.requests = {
	requestArray : ko.observableArray(),
	more : ko.observable(),
	cursorString : null,
	enableUpdate : ko.observable(true),
	initialFetch: false,
	filler : ko.pureComputed(function() {
		var requestArray = self.requests.requestArray();
		var more = self.requests.more();

		// Only show filler div when user does not has requests in ViewModel and
		// in datastore itself.

		return requestArray.length === 0 && !more;
	})
};



self.changeTab = function(tabName) {
	location.hash = tabName;
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



self.catchDeletePost =  function(data, event) {
	/*
		This function captures the click events bubling up from delete post icon buttons.
		Registred on #postsContent div.
	*/
	var button = $(event.target);
	// only run when delete icon button is clicked
	if (!button.hasClass("delete-post-btn-icon-marker")) {
		console.log("delete icon not clicked");
		return;
	}
	var postItemDiv = button.closest('.view-profile-post-item');
	var deletePostId = postItemDiv.attr("data-post-id");

	if (!deletePostId) {
		console.log("could not capture deleting post");
		return;
	} else {
		// 'Delete' button of modal in only enabled when postId is captured.
		deletePostModalButton.prop("disabled", false);
		self.posts.deletePostData.id = deletePostId;
		self.posts.deletePostData.div = postItemDiv;
	}	
}

self.filterPostDeleteEvents = function(data, event) {
	/*
		This function only lets clicks from post delete icon button to bubble upto
		overlaying #postContent div.
		This is meant to overcome shortcoming of simple-modals plugin being used.
	*/
	if (!$(event.target).hasClass("delete-post-btn-icon-marker")) {
		event.stopPropagation();
		return false;
	}
}

function deletePost() {

	if (!self.posts.deletePostData.id) {
		console.log("could not find deletePostId");
		return;
	}

	$.ajax({
		url: "/ajax/delete-post",
		type: "POST",
		dataType: "json",
		data: {"post_id" : self.posts.deletePostData.id},

		success : function() {

			// entire logic goes in velocity's animation calls
			self.posts.deletePostData.div.velocity({
				opacity: 0,
				height: 0,
				paddingTop: 0,
				paddingBottom: 0
			}, {
				duration: 250,
				delay: 100,
				
				begin: function() {
					// close the modal
					deletePostModalCloseButton.trigger("click");

					// Remove the height style from tabContent div if present
					tabContent.css("height", "");

					$(this).css("overflow", "hidden");
				},

				complete: function() {
					// after completeing the animation remove from view model
					var currentPosts = self.posts.postArray();
					var deletePostId = self.posts.deletePostData.id;			
					for (var i =0, l=currentPosts.length; i<l; i++){
						if(currentPosts[i].post_id === deletePostId) {

							//calling ko's splice will cause UI refresh
							self.posts.postArray.splice(i,1);
							break;
						}
					}

					// reset deletePostData
					self.posts.deletePostData.id = null;
					self.posts.deletePostData.div = null;

					// disable the delete button again
					deletePostModalButton.prop("disabled", true);
				}
			});
			
		},

		error: function () {
			console.log("deletePost", "ERROR");
		}
	});
};


function getUserGroups() {
	var dataSent = {"view" : "groups"};
	
	// Only send the AJAX request once
	if (self.groups.initialFetch) {
		return;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,
		success: function(data) {

			// Set initial fetch to true
			self.groups.initialFetch = true;

			/*
				for user with no groups, the data object is - 
				an empty array
			*/
			if (!data) {
				// user already has the data in ViewModel
				// though this is being checked before sending the request
				return;
			}

			var allGroupsData = data;

			if(!allGroupsData.length) {
				// user has not joined/created any group
				return;
			}
			//add images
			for (var i=0, len=allGroupsData.length; i<len; i++){
				allGroupsData[i].cover_image_url = helper.getImageURL(allGroupsData[i].cover_image_url,
															constants.PROFILE_GROUP_IMAGE,
															"group");
			}
			//update observables
			self.groups.allGroupsData(allGroupsData);
		},

		error: function() {
			console.log("getUserGroups:", "ERROR");
		},

		complete: function() {
			handleAjaxComplete("groups");			
		}
	});
}

function getUserPosts(update) {
	var dataSent = {"view" : "posts",
					"cursor_str": null};

	// Don't fetch when we are not updating and already have done initial fetch.
	// This is when user is simply switching tabs.

	if (self.posts.initialFetch && !update){
		return;
	}

	if (update){
		// If cursorString is null with the posts present, that implies
		// there are no more posts and the update button won't be rendered/enabled.
		dataSent.cursor_str = self.posts.cursorString;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,

		beforeSend: function() {
			handleAjaxBeforeSend(update);

			// disable the update button
			self.posts.enableUpdate(false);
		},

		success: function(data){
			/*
				If user has no posts to begin with the data object is - 
				{
					post_list: [],
					cursor_str: null,
					more: false
				}

				while fetching consectively more becomes false which disables the
				button but a cursor string is still returned by datastore
			*/
			self.posts.cursorString = data.cursor_str;
			self.posts.more(data.more);

			// re-enable update button if there are more posts
			if (data.more) {
				self.posts.enableUpdate(true);
			}

			// Set initial fetch to true. Overwrite on updates.
			self.posts.initialFetch = true;

			var postFetched = data.post_list;
			//the db might return None rather that empty list on failed queries
			if(!postFetched || !postFetched.length) {
				return;
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
		},

		complete: function() {
			handleAjaxComplete("posts", update);			
		}
	});
}

self.completeRequest = function(req, event) {
	// req is the request request object

	// make selections for animation calls
	var requestControlsDiv = $(event.target).closest(".view-profile-request-controls");
	var deleteButton = $("button", requestControlsDiv);
	var spinner = $(".spinner", requestControlsDiv);
	var checkIcon = $(".user-profile-request-complete-icon", requestControlsDiv);

	$.ajax({
		url:"/ajax/complete-request",
		type: "POST",
		dataType: "json",
		data: {"request_hash": req.request_hash},

		beforeSend: function() {
			deleteButton.prop("disabled", true);

			var mySequence = [
			    { e: deleteButton, p: "transition.expandOut", o: { duration: 200} },
			    { e: spinner, p: "transition.expandIn", o: { duration: 200, display: "block" } },
			];

			$.Velocity.RunSequence(mySequence);
		},

		success: function(resp) {
			// on success we just update our view and remove that notification
			
			if (!resp) {
				return;
			}

			// fade out the spinner
			spinner.velocity("transition.fadeOut", {
				duration: 300,
				delay: 1500,

				complete: function() {
					// fade in the check icon
					checkIcon.velocity("fadeIn", { duration: 400, display: "block"});

					// Remove the height style from tabContent div if present
					tabContent.css("height", "");

					/*
						Since we already have the reference to the request object, we can
						directly update its observables.

						req is the request object.
					*/
					var updatedText = ("You have accepted <span class='font-weight-bold'>" +
										req.user_name + "</span>'s request.");
					req.complete(true);
					req.text(updatedText);
					req.timestamp(Math.round((Date.now())/1000));

					// Remove the accepted request from the navbar request component
					removeRequestFromComponent(req);

					/*
						Since we are not removing anything from requestsArray obsevable array,
						and the changes are tracked via properties which are observables,
						no need to call valueHasMutated.
					*/
				}
			});// end velocity					
		},

		error: function() {
			// we restore it to original state
			console.log("completeRequest", "ERROR", "userprofile");

			// re-enable delete button
			deleteButton.prop("disabled", false);
			
			var myErrorSequence = [
			    { e: spinner, p: "transition.expandOut", o: { duration: 200} },
			    { e: deleteButton, p: "transition.expandIn", o: { duration: 200, display: "block"} }
			];

			// Queueing the sequence through setTimeout works since the AJAX
			// request was returning too fast.
			setTimeout(function() {
				$.Velocity.RunSequence(myErrorSequence);
			}, 1500)
		}
	});
};

function removeRequestFromComponent(req) {
	//Remove that request from request component's VM and requests dropdown UI.
	if (self.requestComponentObsArray && self.requestComponentObsArray().length) {
		// Add safegaurds for late AJAX requests from the request component
		var componentArr = self.requestComponentObsArray();

		// loop over component's requests
		for(var i=0, l=componentArr.length; i<l; i++){

			// find the request that has been accepted
			if (componentArr[i].request_hash === req.request_hash){
				
				//calling ko's splice will cause UI refresh
				self.requestComponentObsArray.splice(i,1);
				break;
			}
		} 
	}
}

function getUserRequests(update) {
	
	var dataSent = {"view" : "requests",
					"cursor_str": null};

	// Don't fetch when we are not updating and already have done initial fetch.
	// This is when user is simply switching tabs.

	if (self.requests.initialFetch && !update){
		return;
	}

	if (update){
		dataSent.cursor_str = self.requests.cursorString;
	}

	$.ajax({
		url: "/ajax/get-request-notifications",
		type: "GET",
		dataType: "json",
		data: dataSent,

		beforeSend: function() {
			handleAjaxBeforeSend(update);

			// disable the update button
			self.requests.enableUpdate(false);
		},

		success: function(data){

			/*
				If user has no request, data object is - 
				{
					post_list: null,
					cursor_str: null,
					more: null
				}

				While fetching consectively more becomes false which disables the
				button but a cursor string is still returned by datastore
			*/

			self.requests.cursorString = data.cursor_str;
			self.requests.more(data.more);

			// re-enable update button if there are more posts
			if (data.more) {
				self.requests.enableUpdate(true);
			}

			// Set initial fetch to true. Overwrite on updates.
			self.requests.initialFetch = true;

			// The db returns null or empty array depending on wether user is admin of 
			// atleast one group or not.
			var requestsFetched = data.request_list;
			if(!requestsFetched || !requestsFetched.length) {
				return;
			}

			var currentRequests = self.requests.requestArray();
			for (var i=0, len=requestsFetched.length; i<len; i++) {				
				currentRequests.push(new Request(requestsFetched[i]));
			}

			// notify UI subscribers
			self.requests.requestArray.valueHasMutated();
		},

		error: function() {
			console.log("getUserRequests", "ERROR");
		},

		complete: function() {
			handleAjaxComplete("requests", update);
		}
	});
}

function getUserNotifications(update){
	var dataSent = {"view" : "notifications",
					"timestamp": self.notifications.timestamp};

	if(self.notifications.initialFetch && !update){
		return;
	}

	$.ajax({
		url: "/ajax/get-profile-data",
		type: "GET",
		dataType: "json",
		data: dataSent,

		beforeSend: function() {
			handleAjaxBeforeSend(update);

			// disable the update button
			self.notifications.enableUpdate(false);
		},

		success: function(data) {

			// Set initial fetch to true. Overwrite on updates.
			self.notifications.initialFetch = true;

			// enable update without checking notifications.more since it's one request late
			self.notifications.enableUpdate(true);

			/*
				Server retuns null when user has no notifications and
				an empty array when we exhaust them while updating
			*/

			if (!data || data.length === 0){
				// this removes the button
				self.notifications.more(false);

				// disable it anyways
				self.notifications.enableUpdate(false);
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
		},

		complete: function() {
			handleAjaxComplete("notifications", update);
		}
	});
}


function setupTabDataObj() {
	//position is wrt rel positioned tabWrapper div

	$("#tabs span").each(function() {
		var tabName = $(this).attr("data-tab-name");
		var contentDiv = $("#" + tabName + "Content");

		var dataObj = {
			nameSpan: $(this),
			content: contentDiv,
			contentSpinner: $(".content-spinner", contentDiv),
			contentHeader: $(".tab-content-header", contentDiv),
			contentWrapper: $(".tab-content-wrapper", contentDiv),			
			width: $(this).css("width"),
			left: $(this).position().left
		};

		self.tabData[tabName] = dataObj;
	});
}

function handleAjaxBeforeSend(update) {
	if (update) {
		tabContent.css("height", "");
	}
}

function handleAjaxComplete(tab, update) {

	/* 
		Height animation is only used during first fetch.
		For all updates to tab that follow, inline height
		is removed from #tabContent div. 
	*/
	if (update) {
		return;
	}

	if (checkFirstCall()) {
		setupAfterFirstCall(tab);
	}
	else {
		setupTabInnerContent(tab);	
	}
	
}

function setupTabInnerContent(tab) {
	// does not run for first call

	var tabObj = self.tabData[tab];

	/*
		tabObj.content.outerHeight cannot be used as done in animateTabs functions.
		Since that gives height of contentSpinner div. So calculate individual div
		heights and add them.

		outerHeight includes padding.
	*/
	var targetHeight; 
	
	/*
		// Hide the content spinner div.
		// Animate height of main tabContent div.
		// Fade in the content of selected tab.
	*/
	/*var mySequence = [
	    { e: tabObj.contentSpinner, p: { opacity: 0 }, o: { duration: 400, display: "none", delay: 400 } },
	    { e: tabContent, p: { height: targetHeight }, o: { duration: 400 } },
	    { e: tabObj.contentWrapper, p: { opacity: 1 }, o: { duration: 200, display: "block" } }
	];

	$.Velocity.RunSequence(mySequence);*/

	// Unable to use sequence since we need to delay the calculation of targetHeight,
	// while knockout is rendering UI. And the sequence won't take 'complete' callback
	// during any of its steps. The logic is same as running via comment. Only the
	// targetHeight is calculated after delay.

	// watchout for pyramid of death!!!
	tabObj.contentSpinner.velocity("transition.fadeOut", {
		duration: 400,
		delay: 400,
		complete: function() {
			targetHeight = tabObj.contentWrapper.outerHeight() + tabObj.contentHeader.outerHeight();
			tabContent.velocity({height: targetHeight},{
				duration: 400,
				complete: function() {
					tabObj.contentWrapper.velocity("transition.fadeIn", {duration: 200});
				}
			});
		}
	});
}

function setupAfterFirstCall(tab) {
	// this function is only called after the first AJAX call is complete
	// this sets the first tab observable and not the route registered with Sammy
	// tab is the one requested for initial call (default is 'group' as configured in Sammy)

	// function only fires for first call

	

	// set the tab observable
	self.tab[tab](true);

	//remove the spinner and fade in the content wrapper div
	$("#centerColContentWrapper").velocity("transition.fadeIn", {
		duration: 1000,
		delay: 800,
		begin: function() {

			//tabData object has not been initialized yet; use direct selectors
			var tabContentDiv = $("#" + tab + "Content");

			//hide tab specific spinner, 
			$(".content-spinner", tabContentDiv).css("display", "none");

			//display contentWrapper div
			$(".tab-content-wrapper", tabContentDiv).css({
				display: "block",
				opacity: 1
			});

			//hide main spinner
			$("#mainSpinner").css("display", "none");
		},

		complete: function() {
			// tab element ref, widths, positions are stored in self.tabData
			setupTabDataObj();

			// fade in the tabBar
			tabBar.velocity({opacity: 1}, {
				duration: 400,
				begin: function() {
					tabBar.css({
						left: self.tabData[tab].left,
						width: self.tabData[tab].width
					});
				}
			});

		}		
	});// end contentWrapper velocity call
}



function animateTabs(previous, current) {
	
	var barDuration = 300;
	var contentDuration = barDuration/2;
	var previousTab = self.tabData[previous];
	var currentTab = self.tabData[current];
	var motion = null;

	if ( currentTab.left > previousTab.left ) {
		motion = "right";
	} else {
		motion = "left";
	}

	var currentHeight = currentTab.content.outerHeight();

	tabBar.velocity({left: currentTab.left}, {
		duration: barDuration
	});

	previousTab.content.velocity(motionEffect[motion].previous, {
		duration: contentDuration,
		complete: function() {
			self.tab[previous](false);
			currentTab.content.velocity(motionEffect[motion].current, {
				duration: contentDuration,
				begin: function() {
					self.tab[current](true);
				}
			});
		}
	});


	tabContent.velocity({height: currentHeight}, {
		duration: contentDuration,
		complete: function() {
			//console.log("animateTabs", currentHeight);

			// tab action is queued after the animateTab height animation completes
			// this removes 0 height bug from setupTabInnerContent call
			self.tabAction[current]();
		}
	});
}

function checkFirstCall() {

	// once checkFirstCallResult becomes false, it will always remain false
	if (checkFirstCallResult === false) {
		return false;
	}

	var first = true;
	for (t in self.tab) {
  		// don't loop over inherited properties
		if (!self.tab.hasOwnProperty(t)) {
			continue;
		}

		// if one of the observables is true, means it is no the first call
		if (self.tab[t]()) {
			first = false;
			break;
		}
	}
	// save result in ViewModel level var
	checkFirstCallResult = first;
	
	return first;
}


Sammy(function() {
    this.get('#:tabSelected', function() {
    	var sammyThis = this;
        var tabSelected = sammyThis.params.tabSelected;
        var previousTab;        

		// first call case handled by AJAX complete functions
		if (!checkFirstCall()) {
			// find previous tab
	      	for (t in self.tab) {
	      		// don't loop over inherited properties
				if (!self.tab.hasOwnProperty(t)) {
	    			continue;
				}

				if (self.tab[t]()) {
					previousTab = t;
					break;
				}
				
			}

			// animation and observables are handled at the time of animation.
			animateTabs(previousTab, tabSelected);			
		} else {
			// call the action function
			// this is the call for first case; rest calls are made from animateTabs
			// to queue the tabAction and and animateTabs height animation
			self.tabAction[tabSelected]();
		}	    	
    });

    this.get('/view-profile', function() {
    	//get groups by default
    	this.app.runRoute('get', "#groups");
	});

    //ignore the form submit
	this.post('/ajax/edit-profile', function() {
		return false;
	});
}).run();

function PostNotification(n){
	var self = this;

	self.notificationText = helper.getPostNotificationText(n)
	self.postId = n.post_id;
	self.groupId = n.group_id;
	self.groupUrl = "/group/" + n.group_id;
	self.groupName = n.group_name;
	self.posterName = n.poster_name;
	self.posterImage = helper.getImageURL(n.poster_image, constants.PROFILE_NOTIFICATION_IMAGE, "user");
	self.timestamp = n.timestamp;
	self.timestampText = helper.getTimestampText(n.timestamp, true);
};

function Request(r){
	var self = this;

	self.group_name = r.group_name;
	self.user_name = r.user_name;
	self.user_image = helper.getImageURL(r.user_image,
										 constants.PROFILE_REQUEST_IMAGE,
										 "user");

	self.request_hash = r.request_hash;
	self.request_type = r.request_type;
	self.complete = ko.observable(r.complete);
	self.text = ko.observable(helper.getRequestText(r));
	
	self.timestamp = ko.observable(r.timestamp);
	self.timestampText = ko.pureComputed(function(){
		var timestamp = self.timestamp();
		return helper.getTimestampText(timestamp, true);
	}); 
};

}; // end view model

}); // end define function
