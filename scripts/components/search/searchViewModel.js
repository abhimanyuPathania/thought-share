
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/search/searchTemplate.html'],
function(ko, $, helper, constants, htmlString) {

function SearchViewModel() {

var searchWrapper = $("#search .dropdown-wrapper");
self.groupQueryResults = ko.observable();
self.query = ko.observable();

self.focus = ko.observable(false);
self.showClear = ko.observable(false);

self.addFocus = function(){
	self.focus(true);
}

self.clearSearch = function() {
	self.query(null);
	self.focus(true);
}

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

		//var queryString = $.trim(event.target.value);
		var queryString = $.trim(self.query());
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
					//add group thumbnail URL and description preview
					for(var i=0, len=resp.length; i<len; i++){
						resp[i].image = helper.getImageURL(resp[i].image,
														   constants.SEARCH_IMAGE,
														   "group");
						resp[i].descriptionPreview = getDescriptionPreview(resp[i].description);
					}
					self.groupQueryResults(null);
					self.groupQueryResults(resp);
					helper.showDropdown(searchWrapper);			
				},

				error: function() {
					console.log("queryGroups:", "ERROR");
				}
			});	

		}, constants.SEARCH_AJAX_REQUEST_TIMEOUT) //call after xyz milli seconds

	}; //end function being returned

}());// end anon function

self.query.subscribe(function(){
	if (self.query()) {
		//detected text input

		//show 'clear' button if not there
		if(!self.showClear()){
			self.showClear(true);
		}

		//do search
		self.queryGroups();
	} else{
		self.showClear(false);
	}
});

// self.focus.subscribe(function()){
	
// }	

function getDescriptionPreview(desc){
	var previewLimit = constants.GROUP_DESCRIPTION_PREVIEW_CHAR_LIMIT;
    if (desc.length <= previewLimit) {
        return desc;
    }
    
    var space = desc.lastIndexOf(" ", previewLimit);
    return desc.substring(0, space) + "...";
}

}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: SearchViewModel, template: htmlString };

});