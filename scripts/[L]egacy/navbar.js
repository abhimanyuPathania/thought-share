
define(['jquery'], function($){

return {
	init : function() {

		var drowpdownDivs = $(".dropdown-wrapper");
		var profileTrigger = $("#profile .dropdown-display");
		var profileDropdown = $("#profile .dropdown-wrapper");
		
		// detecting click outside the dropdown menus to close them
		
		/* https://css-tricks.com/dangers-stopping-event-propagation/ */
		$(document).on('click', function(event) {
			/*test if the click is coming from a '.dropdown' element
			  or its descendent and ignore those events*/
			if (!$(event.target).closest('.dropdown').length) {
		    	// Hide the menus.
		    	drowpdownDivs.removeClass("show");
		  	}

		}); // end event handler

		//intialize dropdown for the non-componet profile
		profileTrigger.on('click', function(){
			this.toggleDropdown(profileDropdown);
		}.bind(this));
	},// end init

	toggleDropdown : function(element) {
		var dropdownWrappers = $(".dropdown-wrapper");

		if (element.hasClass("show")){
			//hiding; simple remove
			element.removeClass("show");
		} else {
			// showing; hide other dropdowns first it visible
			dropdownWrappers.removeClass("show");

			//show the dropdown we want
			element.addClass("show");
		}
	},

	showDropdown : function (element) {
		//only used in diplaying search results

		var dropdownWrappers = $(".dropdown-wrapper");
		if (!element.hasClass("show")){
			dropdownWrappers.removeClass("show");
			element.addClass("show");
		}
	}

}


});