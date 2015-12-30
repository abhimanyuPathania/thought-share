
define(['knockout',
		'jquery',
		'sammy',
		'helper',
		'constants',
		'libs/autosize.min',
		'velocity',
		'velocity-ui'],
function(ko, $, Sammy, helper, constants, autosize, Velocity) {
   
return function feedPageViewModel() {
	var self = this;
	//---data---//

	//this is used to pass as a reference to post ntf component
	self.parentRef = self;
	
	//this serves as an id for feedPageViewModel
	self.feedPage = true;

	//instantiated from the user json fetched via hidden html
	self.user = null;

	self.groups = ko.observable();
	self.currentGroup = ko.observable();

	self.feed = ko.observableArray();
	self.moreFeed = ko.observable(false);
	self.postCursor = null;
	//delay for fadeIn used the ko's afterAdd binding for posts
	self.fadeDelay = 0;

	//holds text user types in text area
	self.userPost = ko.observable();
	//hasFocus binding for the text area
	self.userPostFocus = ko.observable(false);

	//this flag saves us from polling server to get latest posts in feed
	self.newFeedFlag = ko.observable(false);

	//observables to set filler messages
	self.noGroupJoinedMessage = ko.observable(null);
	self.noPostMessage = ko.observable(null);
	
	//kick of the data fetching functions
	initialize();
	

	//---behaviour---//

	self.fadeInPost = function(element) {
		var element = $(element);
		if (element.hasClass("post-item")){
			element.velocity("fadeIn", {
				duration: 400,
				delay: self.fadeDelay
			});
		}
	}

	self.showPostControlDropdown = function(ob, event) {
		var dropdown = $(event.target).closest(".post-control-display").next();

		// return if dropdown already visible
		// this also allows event to bubble, so same button acts to close dropdown
		if (dropdown.hasClass("visible")){
			return;
		}

		//fade in the dropdown and add the marker "visible" class
		dropdown.velocity("fadeIn", {duration: 150});
		dropdown.addClass("visible");

		//this prevents the same click to close the dropdown, which opened it in first place
		event.stopPropagation();
	}

	self.updateCurrentGroup = function(group) {
		location.hash = group.id;
	}

	self.fetchOlderPosts = function() {
		if (!self.moreFeed()){
			return false;
		}

		// fetches an object with properties 'post_list', 'cursor_str', 'more'
		var data = {"group_id": self.currentGroup().id,
					"cursor_str": self.postCursor}
		var button = $("#moreFeed button");

		$.ajax({
			url: "/ajax/get-group-feed",
			type: "GET",
			dataType: "json",
			data: data,
			beforeSend: function() {
				button.prop("disabled", true);
			},

			success: function(feedObj){				
				var postArray = feedObj.post_list;
				var currentFeed = self.feed();

				//select the 'id' if first post-item DIV to be inserted
				var scrollIdSelector = "#" + postArray[0].post_id; 

				//add the timestamp text property to each post from feed
				for (var i=0, len=postArray.length; i<len; i++) {
					//add timestampText and push on the current feed array
					currentFeed.push(new FeedPost(postArray[i]));
				}

				// fadeIn faster
				self.fadeDelay = 0;

				// notify UI subscribers
				self.feed.valueHasMutated();

				//set the feed flags
				self.moreFeed(feedObj.more);
				self.postCursor = feedObj.cursor_str;

				//scroll to the first of newly inserted posts
				$(scrollIdSelector).velocity("scroll", {
					duration: 800,
					offset: -62,
					delay: 100,
					begin: function() {
						//remove transitions before using JS animations
						$(this).css("transition", "none");
					}
					//apply a darker color flash
				}).velocity({backgroundColor: "#DDDDDD"}, {
					duration: 300

					//restore to original backgroundColor
				}).velocity({backgroundColor: "#FFFFFF"}, {
					duration: 300,
					delay: 200,

					//remove the inline CSS and revert to normal after animation
					complete: function() {
						$(this).css({
							"backgroundColor": "",
							"transition": ""
						});
						self.fadeDelay = 400;
					}
				});		
			},

			error: function(){
				console.log("ERROR", "fetchOlderPosts");
			},

			complete: function () {
				button.prop("disabled", false);
			}
		});
	}

	self.closeNewFeedDialog = function(obj, event) {
		self.newFeedFlag(false);
		event.stopPropagation();
	}

	self.updateCurrentGroupFeed = function() {
		if (!self.newFeedFlag()){
			return false;
		}

		var currentFeed = self.feed()
		var latestTimestamp = getLatestPostTimestamp();

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

					//ignore the post by posted by user in the updates to fix feed holes
					if(postArray[i].user_id === self.user.id){
						continue;
					}
					
					//add the post at the front of existing feed
					currentFeed.unshift(new FeedPost(postArray[i]));
				}

				//reset the newFeedFlag
				self.newFeedFlag(false);
				
				//scroll to top of page
				$("#currentGroup").velocity("scroll", {
					duration: 600,

					//update view on scroll completion
					complete: function() {
						//notify the subscribers to update the UI
						self.feed.valueHasMutated();
					}
				});	
			},

			error: function(){
				console.log("ERROR", "updateCurrentGroupFeed");
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

				//create the post model using object returned and
				//adding poster properties (self.user)
				postObj.poster_name = self.user.display_name;
				postObj.poster_image = self.user.image_url;
 				
				var postObjProcessed = new FeedPost(postObj);
 				// extra property on post obj when user posts in group
				postObjProcessed.selfPosted = true;
				
				// first post in group. Hide filler message
				if (self.noPostMessage()) {
					self.noPostMessage(false);
					$("#postListWrapper").css("opacity", 1);
				}

				//using ko's unshift causes auto UI refresh
				self.feed.unshift(postObjProcessed);

				//clear content of textarea and remove classes
				self.cancelUserPost();
			},

			error: function(xhr) {
				console.log("ERROR:", "postInCurrentGroup");
			}
		});
	};

	self.userPostFocus.subscribe(function(){
		if (!self.userPostFocus()){
			return;
		}

		var currentGroupDiv = $("#currentGroup");

		// only add "focus" class if not present
		if(!currentGroupDiv.hasClass("focus")){
			currentGroupDiv.addClass("focus");
			$("#postInGroup").addClass("focus");
		}
		
	});

	self.cancelUserPost = function(){

		setTimeout(function(){
			self.userPost(null);
			$("#postInGroup textarea").css("height", "");
			$("#currentGroup, #postInGroup").removeClass("focus");	
		}, 150);		
	}

	self.deletePost = function(post, event) {
		var postItem = $(event.target).closest(".post-item");
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
				
				//logic goes in velocity's complete function
				postItem.velocity({
					opacity: 0,
					height: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom:0
				}, {
					duration: 250,
					begin: function(){
						postItem.css({
							transition: "none",
							overflow: "hidden"
						});
					},

					complete: function(){
						
						//after animating out the deleted post-item, 
						//remove it from the ViewModel
						var currentPosts = self.feed();
						for (var i =0, l=currentPosts.length; i<l; i++){
							if(currentPosts[i].post_id === post.post_id) {
								self.feed.splice(i,1);
								break;
							}
						}

						// delete the only post in group and no more in datastore(edge case)
						if (!self.feed().length && !self.moreFeed()) {
							// hide the post list wrapper (required for imitating fade animation)
							$("#postListWrapper").css("opacity", 0);

							// show the no post message if both VM and datastore don't have more posts
							self.noPostMessage(true);						
						}

					}// end complete

				}); //end velocity			
			},

			error: function () {
				console.log("deletePost", "ERROR");
			}
		});
	};

	self.editPost = function(post, event) {
		
		if (post.editing()){
			return;
		}

		//select post-item div
		var postItem = $(event.target).closest(".post-item");
		
		//whole logic is added in velocity's pre-animation begin call

		//on editing fade-in post-edit div. It's opacity is set 0 in CSS
		$(".post-edit", postItem).velocity({opacity: 1},{
			duration: 400,
			queue: false,

			//before we start fading-in post-edit div
			begin: function(){
				var ta;

				post.preEditPost = post.post();

				//this obeservable sets 'post-item-post' to display none and
				//'post-control' to "block"
				post.editing(true);

				//apply autosize on 'textarea' within 'post-control' since now
				//it's set to display "block", the plugin works
				ta = $("textarea", postItem);
				autosize(ta);

				//set the opacity of 'post-item-post', to 0, which has been set
				//to display "none" by ko's visible binding on post.editing observable
				$(".post-item-post", postItem).css("opacity", 0);

				//add class for the additional CSS transitions
				postItem.addClass("currently-editing");

				//save textarea's height for restoring it on cancel
				post.preEditTextareaHeight = ta.css("height");
			}

		});
		
	};

	self.cancelEdit = function(post, event, saving) {
		var postItem = $(event.target).closest(".post-item");

		// saving is a variable to detect if the function is called via self.saveEdit()

		//set back the opacity of 'post-item-post' to 1
		$(".post-item-post", postItem).velocity({opacity: 1}, {
			duration: 400,
			delay: 150, // delay eases the click on 'cancel' button
			queue: false,

			//before fading in 'post-item-post'
			begin: function(){

				//if we are saving the post, don't reset the post's content
				//to the of preEditPost content saved on start of edit
				if (saving !== "saving"){
					//this is the 'cancelEdit' case

					//restore value of post to original pre-edit value
					post.post(post.preEditPost);

					//restore editing textarea's height
					$("textarea", postItem).css("height", post.preEditTextareaHeight);
				}

				//this obs via ko's binding set 'post-item-post' to display "block"
				//and 'post-edit' to display "none"				
				post.editing(false);

				//remove opacity from 'post-edit', so that it could be faded-in again
				$(".post-edit", postItem).css("opacity", 0);

				//remove the CSS class for additional transitions
				postItem.removeClass("currently-editing");
			}
		});
		
	};

	self.saveEdit = function(post, event) {
		var postContent = $.trim(post.post());

		//don't save empty or non edited posts
		if ( !postContent.length || postContent === post.preEditPost ){
			return;
		}

		$.ajax({
			url: "/ajax/edit-post",
			type: "POST",
			dataType: "json",
			data: {"post_id": post.post_id,
				   "post_content" : postContent},

			success: function () {
				self.cancelEdit(post, event, "saving");
			},

			error: function() {
				//!!!!! handle this
				self.cancelEdit(post, event);
				console.log("saveEdit", "ERROR");
			}
		});

	};

	function initialize() {
		console.log("Starting Thought Share...");

		// ----- initialize group list and user models ----- //
		var groupJSON = $("#userGroupsJSON").attr("data-groupJSON");
		var userJSON = $("#userJSON").attr("data-userJSON");
		var groups = JSON.parse(groupJSON);
		var user = JSON.parse(userJSON);

		self.user = user;

		//return if user has joined no groups
		if(groups.length <= 0) {
			return;
		}
		//set thumbnail for user
		user.thumbnail_url = helper.getImageURL(user.image_url,
												constants.FEED_TEXTAREA_USER_IMAGE,
												"user");

		//sort the groups by name
		groups = getSortedGroups(groups);

		//set thumbnails landing page urls for the groups
		for(var i=0, l=groups.length; i<l; i++){
			groups[i].cover_image_url = helper.getImageURL(groups[i].cover_image_url,
															constants.GROUP_LIST_ITEM_IMAGE,
															"group");
			groups[i].url = "/group/" + groups[i].id;	
		}
		//initialize observables
		self.groups(groups);
		self.currentGroup(groups[0]);	

		// ----- setup basic event handlers ----- //
		
		//to close post control dropdowns
		$(document).on('click', function(event){
			var visibleDropdown = $(".post-control-dropdown.visible");

			//return if no post control dropdown is visible
			if (!visibleDropdown.length){
				return;
			}

			//remove class and fade out
			visibleDropdown.removeClass("visible");
			visibleDropdown.velocity("fadeOut", {duration: 150});
		});

		//setup the textarea resize
		autosize($("#postInGroup textarea"));
	};

	
	function fetchCurrentGroupFeed() {
		// called on changing current group and an initial call through Initialize function
		// this function is never called if user has not joined any gourp

	    var firstCall = testFirstCall();
	    var feedSpinnerDiv = $("#feedSpinner");
	    var delay = 1000;
	    if (!firstCall) {
	    	delay = 700;
	    }

		// fetches an object with properties 'post_list', 'cursor_str', 'more'
		var data = {"group_id": self.currentGroup().id,
					"cursor_str": self.postCursor}

		$.ajax({
			url: "/ajax/get-group-feed",
			type: "GET",
			dataType: "json",
			data: data,

			beforeSend: function () {
				// during first call the spinner is visible by default
				if (firstCall) {
					return;
				}
				
				// for next calls, fade in the spinner(displayed over the feed)
				feedSpinnerDiv.velocity({opacity:1}, {
					duration: 120,
					display: "flex"
				});
			},

			success: function(feedObj){				
				var postArray = feedObj.post_list;
				var postListWrapperDiv = $("#postListWrapper");			
				var currentGroupDiv = $("#currentGroup");

				//first fade away the spinner
				feedSpinnerDiv.velocity("fadeOut", {
					duration: 200,
					delay: delay,

					complete: function() {
						// fade in the currentGroupDiv for first call,
						// visible during all next calls to fetchCurrentGroupFeed
						if (firstCall) {
							currentGroupDiv.velocity("fadeIn", {duration:400});
						}

						postListWrapperDiv.velocity({opacity:0}, {
							duration: 60,

							complete: function () {
								
								//display noPostMessage if none fetched
								//the db returns None rather that empty list on failed queries
								if(!postArray || (postArray && !postArray.length)) {

									// update ViewModel. This also takes children post-items
									// out of DOM
									self.feed([]);

									//display the no post message
									self.noPostMessage(true);

									//reset reamining flags
									self.newFeedFlag(false);
								} else {
									// reset old ViewModel and observables
									self.feed([]);
									self.newFeedFlag(false);

									//reset the opacity to 1(imitating fade away of post-list)
									postListWrapperDiv.css("opacity", 1);

									//fadeout not post message
									self.noPostMessage(false);

									//build array of new post objects
									var newGroupFeed = [];
									for (var i=0, len=postArray.length; i<len; i++) {
										//add timestampText and push on the current feed array
										newGroupFeed.push(new FeedPost(postArray[i]));
									}

									//set new ViewModel and UI refresh
									self.feed(newGroupFeed);
								}

								//update moreFeed flag and post cursor for next fetch
								self.moreFeed(feedObj.more);
								self.postCursor = feedObj.cursor_str;
								if (firstCall) {
									//marker class for seperate CSS during first and next calls
									feedSpinnerDiv.addClass("second");
									//change the post fadeIn delay
									self.fadeDelay = 400;
								}

							} //end postListWrapperDiv complete

						}); //end postListWrapperDiv velocity call

					} // end feedSpinnerDiv complete(main)

				}); // end feedSpinnerDiv velocity(main)		

			}, //end AJAX success

			error: function(){
				console.log("ERROR:", "fetchCurrentGroupFeed");
			}
		});

		function testFirstCall() {

			if ((self.noGroupJoinedMessage() === null) && 
				(self.noPostMessage() === null) &&
				(self.feed().length === 0)) {
				return true;
			}

			return false; 
		}
	};

	// Client-side routes    
    Sammy(function() {
        this.get('/feed#:gid', function() {
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

            //remove old feed's cursor;
            self.postCursor = null;

            //reset fadeDelays and newfeed flag
            self.newFeedFlag(false);
            self.fadeDelay = 0;

            //get updated group's feed
            fetchCurrentGroupFeed();
        });

        //route /feed to intial currentGroup
        //this also lets other routes function
        this.get('/feed', function() {
        	if (self.currentGroup()){
        		var defaultRoute = "/feed#" + self.currentGroup().id;
        		this.app.runRoute('get', defaultRoute);
        	} else {
        		//this means user has not joined any group yet
        		//fadeout the spinner and display filler message
        		$("#feedSpinner").velocity("fadeOut", {
        			duration: 400,
        			complete: function() {
        				self.noGroupJoinedMessage(true);
        			}
        		});    		
        	}
    	});
    }).run();


function getLatestPostTimestamp(){
	/* Called in updateCurrentGroupFeed to get the latest timestamp
	   of the post by user other than self in feed.
	*/
	var postArray = self.feed();
	if (!postArray.length){
		return 0;
	}
	//initialize to most recent by default
	var latestTimestamp = postArray[0].created;

	for (var i=0, len=postArray.length; i<len; i++){
		// [0] index is the latest
		// find the latest post in feed which is not posted by the user itself
		if(!postArray[i].selfPosted){
			latestTimestamp =  postArray[i].created;
			break;
		}
	}

	return latestTimestamp;
}

function getSortedGroups(data) {
	/* called in setGroupsAndUser to sort the user's group retrieved via embedded json */
	var result = [];
	var groupNames = Object.keys(data);
	groupNames = groupNames.sort();
	for(var i=0, len=groupNames.length; i<len; i++) {
		result[i] = data[groupNames[i]];
	}
	return result;
}

function FeedPost(post) {

	this.group_id = post.group_id;
	this.group_name = post.group_name;
	this.user_id = post.user_id;
	this.poster_name = post.poster_name

	//get thumbnail url
	this.poster_image = helper.getImageURL(post.poster_image,
										   constants.FEED_POSTER_IMAGE,
										   "user");
	
	// only use observables for own/editable posts
	if (post.user_id === self.user.id){
		this.post = ko.observable(post.post);

		//add a preEdit property to restore post on cancel edit functionality
		this.preEditPost = null;

		//save height to restore autosized textarea's height
		this.preEditTextareaHeight = null;
	} else {
		this.post = post.post;
	}
	
	this.post_id = post.post_id;
	this.created = post.created
	this.timestampText = helper.getTimestampText(post.created);

	this.editing = ko.observable(false);
}

function HotGroup(g){
	this.name = g.name;
	this.url = "/group/" + g.id;
	this.membersNumber = g.members_number;
	this.membersText = (function(){
		var num = g.members_number;
		return (num === 1 ? num + " member" : num + " members");
	}());
	
	this.imageURL = g.cover_image_url;
	this.thumbURL = helper.getImageURL(g.cover_image_url,
									   constants.HOT_GROUPS_IMAGE,
									   "group");
	
}

}; // end view model

}); // end define function