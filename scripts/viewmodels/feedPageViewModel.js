
define(['knockout', 'jquery', 'sammy', 'helper'], function(ko, $, Sammy, helper) {
   
return function feedPageViewModel() {
	var self = this;

	//---data---//

	//this is used to pass as a reference to post ntf component
	self.feedPageViewModelRef = self;

	self.user = null;
	self.groups = ko.observable();
	self.currentGroup = ko.observable();
	self.feed = ko.observable();
	self.userPost = ko.observable();

	self.groupQueryResults = ko.observable();

	//this flag saves us from polling server to get latest posts in feed
	self.newFeedFlag = ko.observable(false);
	
	setGroupsAndUser();
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
	};

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
	};

	function fetchCurrentGroupFeed() {
		
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
	};

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
