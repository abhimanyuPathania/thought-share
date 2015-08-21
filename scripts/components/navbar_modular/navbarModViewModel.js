

define(
	['knockout',
	 'jquery',
	 'helper',
	 'constants',
	 'components/request/requestViewModel',
	 'components/post/postViewModel',
	 'components/search/searchViewModel',
	 'libs/text!components/navbar_modular/navbarModTemplate.html'],
function(ko, $, helper, constants, reqCompObj, postCompObj, searchCompObj, htmlString) {

function navbarModularViewModel(params) {

	var self = this;

	//this goes ripling down to the post notifications component
	self.parentRef = params.parentRef;

	//register the sub-components
	ko.components.register('request-notification', reqCompObj);
	ko.components.register('post-notification', postCompObj);
	ko.components.register('group-search', searchCompObj);
	
	self.navbarData = ko.observable();

	//add click handler to the profile dropdown
	self.toggleProfileDropdown = function(obj, event) {
		helper.toggleDropdown($("#profile .dropdown-wrapper"));
	}
	
	// detecting click outside the dropdown menus to close them
	
	/* https://css-tricks.com/dangers-stopping-event-propagation/ */
	$(document).on('click', function(event) {
		/*test if the click is coming from a '.dropdown' element
		  or its descendent and ignore those events*/
		if (!$(event.target).closest('.dropdown').length) {
	    	// Hide the menus.
	    	// cannot cache this selector due to web components issue
	    	$(".dropdown-wrapper").removeClass("show");
	  	}

	}); // end event handler

	//fetch navbar-data
	fetchNavbarData();

	//start the update timestamp timer
	updateTimstamps();

	function fetchNavbarData(){
		$.ajax({
			url: "/ajax/get-navbar-data",
			type: "GET",
			dataType: "json",

			success: function(resp) {
				if (!resp){
					return;
				}
				self.navbarData(new NavbarData(resp));
				if (self.parentRef && self.parentRef.userProfileViewModel){
					self.parentRef.navbarData(self.navbarData());
				}
			},

			error: function(){
				console.log("ERROR:", "fetchNavbarData");
			}
		});
	};

	function updateTimstamps(){
		var liveTimestamps = $(".timestamp");
		
		liveTimestamps.each(function(){
			var element = $(this);
			var timestamp = element.attr("data-timestamp");

			//undefined if not set and "true"(string) if set
			var ntf = element.attr("data-notification");

			element.text(helper.getTimestampText(timestamp, ntf));
		});
		setTimeout(updateTimstamps, constants.LIVE_TIMESTAMPS_TIMEOUT);
	}

	function NavbarData(data){
		this.displayName = ko.observable(data.display_name); 
		this.email = data.email;
		this.imageURL = ko.observable(data.image_url);

		this.imageThumb = ko.pureComputed(function(){
			var currentImageURL = this.imageURL();
			return helper.getImageURL(currentImageURL, constants.NAVBAR_USER_IMAGE, "user");
		}, this);
		
		this.firstName = ko.pureComputed(function(){

			var name = this.displayName();
		    var space = name.indexOf(" ");
		    var firstName;
		    
		    if(space === -1){
		        firstName = name;
		    } else {
		        firstName = name.substring(0, space);
		    }
		    
		    return firstName;
		}, this);

		this.logoutURL = data.logout_url;
	}

} // end navbarModularViewModel

	// Return component definition, this is used in main.js
	return { viewModel: navbarModularViewModel, template: htmlString, synchronous: true };
		
});