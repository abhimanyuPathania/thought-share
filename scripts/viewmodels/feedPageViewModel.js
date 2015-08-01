
define(['knockout', 'jquery', 'sammy', 'helper'], function(ko, $, Sammy, helper) {
   
return function feedPageViewModel() {
	var self = this;

	//---data---//

	//this is used to pass as a reference to post ntf component
	self.feedPageViewModelRef = self;

	self.user = null;

	self.groups = ko.observable();
	self.currentGroup = ko.observable();

	self.feed = ko.observableArray();
	self.moreFeed = ko.observable();
	self.postCursor = null;

	self.userPost = ko.observable();

	//this flag saves us from polling server to get latest posts in feed
	self.newFeedFlag = ko.observable(false);
	
	setGroupsAndUser();

	//---behaviour---//
	self.updateCurrentGroup = function(group) {
		location.hash = group.id;
	}

	self.fetchMorePosts = function() {
		if (!self.moreFeed()){
			return false;
		}

		//simply call the main method
		fetchCurrentGroupFeed();
	}

	self.updateCurrentGroupFeed = function() {
		if (!self.newFeedFlag()){
			return false;
		}

		var currentFeed = self.feed()
		var latestTimestamp = currentFeed[0].created;

		$.ajax({
			url: "/ajax/update-group-feed",
			type: "GET",
			dataType: "json",
			data: {"group_id": self.currentGroup().id,
				   "latest_timestamp": latestTimestamp},

			success: function(postArray){				
				if(!postArray){
					return;
				}

				//looping in reverse
				for (var i=postArray.length-1; i>=0; i--) {
					//add the post at the front of existing feed
					currentFeed.unshift(new FeedPost(postArray[i]));
				}
				
				//reset the newFeedFlag
				self.newFeedFlag(false);
				//notify the subscribers to update the UI
				self.feed.valueHasMutated();
			},

			error: function(){
				console.log("Something went wrong while updating FEED");
			}
		}); // end $.ajax
	
	};// end self.updateCurrentGroupFeed

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
				   
			success: function (postObj) {
				if (!postObj){
					return;
				}

				self.userPost(null);
				//create the post model using object returned and
				//adding poster properties (self.user)
				postObj.poster_name = self.user.name;
				postObj.poster_image = self.user.thumbnail_url;
 
				//using ko's unshift causes auto UI refresh
				self.feed.unshift(new FeedPost(postObj));
			},

			error: function(xhr) {
				console.log("something went wrong while posting in group");
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
				var currentPosts = self.feed();
				for (var i =0, l=currentPosts.length; i<l; i++){
					if(currentPosts[i].post_id === post.post_id) {
						self.feed.splice(i,1);
						break;
					}
				}
			},

			error: function () {
				console.log("deletePost", "ERROR");
			}
		});
	};

	self.editPost = function(post) {
		post.editing(true);
	};

	self.cancelEdit = function(post) {
		post.editing(false);
	};

	self.saveEdit = function(post) {
		console.log(post.post());
		// front end validation for edited post here

		$.ajax({
			url: "/ajax/edit-post",
			type: "POST",
			dataType: "json",
			data: {"post_id": post.post_id,
				   "post_content" : post.post()},

			success: function () {
				post.editing(false);
			},

			error: function() {
				console.log("saveEdit", "ERROR");
			}
		});

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
		// fetches an object with properties 'post_list', 'cursor_str', 'more'
		var data = {"group_id": self.currentGroup().id,
					"cursor_str": self.postCursor}

		$.ajax({
			url: "/ajax/get-group-feed",
			type: "GET",
			dataType: "json",
			data: data,			
			success: function(feedObj){				
				var postArray = feedObj.post_list;

				//always update viewmodel properties
				self.moreFeed(feedObj.more);
				self.postCursor = feedObj.cursor_str;
				//self.newFeedFlag(false);

				//the db returns None rather that empty list on failed queries
				if(!postArray) {
					return false;
				}
				var currentFeed = self.feed();
				//add the timestamp text property to each post from feed
				for (var i=0, len=postArray.length; i<len; i++) {
					//add timestampText and push on the current feed array
					
					currentFeed.push(new FeedPost(postArray[i]));
				}

				// notify UI subscribers
				self.feed.valueHasMutated();			
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

            //update current group
            self.currentGroup(group);

            //clear user post textarea
            self.userPost(null);

            //remove the previous group's feed
            self.feed([]);

            //clear previous cursor
            self.postCursor = null;

            //get updated group's feed
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

function FeedPost(post) {

	this.group_id = post.group_id;
	this.group_name = post.group_name;
	this.user_id = post.user_id;
	this.poster_name = post.poster_name
	this.poster_image = post.poster_image;
	
	// only user observables for own/editable posts
	if (post.user_id === self.user.id){
		this.post = ko.observable(post.post);
	} else {
		this.post = post.post;
	}
	
	this.post_id = post.post_id;
	this.created = post.created
	this.timestampText = helper.getTimestampText(post.created);

	this.editing = ko.observable(false);
}

}; // end view model

}); // end define function
