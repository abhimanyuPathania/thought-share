
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/search/searchTemplate.html'],
function(ko, $, helper, constants, htmlString) {

function SearchViewModel() {

var searchWrapper = $("#search .dropdown-wrapper");
self.groupQueryResults = ko.observable();

self.queryGroups = (function (){

	//closure variables to keep track of requests
	var activeRequest;
	var timer;

	return function(koObj, event) {
		
		//both the checks below must happen before we test for new pattern

		//check for previous incomplete request and abort it
		if (activeRequest) {
			activeRequest.abort();
		}

		//clear queued request that has not been sent
		clearTimeout(timer);

		var queryString = $.trim(event.target.value);
		var pattern = constants.GROUP_NAME_REGEX;
		
		if (!pattern.test(queryString)) {
			self.groupQueryResults(null);

			if (searchWrapper.hasClass("show")){
				searchWrapper.removeClass("show");
			}
			return false;
		}
		// if we come till here that means now we have something to query for

		//set request to query for the current queryString
		
		timer = setTimeout(function(){
			activeRequest = $.ajax({
				url: '/ajax/group-text-search',
				type: "GET",
				dataType: "json",
				data: {"q": queryString},
				success: function(resp) {
					if (!resp){
						return false;
					}
					//add group thumbnail URL
					for(var i=0, len=resp.length; i<len; i++){
						resp[i].image = helper.getImageURL(resp[i].image,
														   constants.SEARCH_IMAGE,
														   "group");
					}
					self.groupQueryResults(null);
					self.groupQueryResults(resp);
					helper.showDropdown(searchWrapper);			
				},

				error: function() {
					console.log("error at group text search");
				}
			});	

		}, constants.SEARCH_AJAX_REQUEST_TIMEOUT) //call after xyz milli seconds

	}; //end function being returned

}());// end anon function	


}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: SearchViewModel, template: htmlString };

});