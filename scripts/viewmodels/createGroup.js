define(['knockout',
		'jquery',
		'enableForms',
		'constants',
		'velocity',
		'velocity-ui'], 
function( ko, $, enableForms, constants, Velocity ){

return function CreateGroupViewModel() {

var self = this;

//set parent to null for the component usage on non-feed pages
self.parentRef = null;

//var createGroupForm = $("#createGroupForm");
var textarea = $(".material-description-field textarea");
var nameInput = $(".material-name-field input[type=text]");
var inputList = textarea.add(nameInput);
var checkboxIconDiv = $(".checkbox-icons");
var imageMetadata = {
	"url": constants.DEFAULT_GROUP_IMAGE,
	"size": constants.CREATE_GROUP_IMAGE_UPLOAD_PREVIEW_IMAGE
}

enableForms.setupInputGuidesAndLabels(inputList);
enableForms.setupDescriptionField( $(".material-description-field") );
enableForms.setupImageUploadField( $(".material-image-upload"), imageMetadata );

// Tracks UI display of nameAvailableDiv - Boolean
self.showAvailability = ko.observable();

// Result of AJAX call to check availability of group name - Boolean
self.groupNameAvailable = ko.observable();

// nameAvailableDiv span text - String / Text binding
self.groupNameAvailableText = ko.pureComputed( function() {
	var available = self.groupNameAvailable();
	return available ? "Group name available" : "Group name not available";
});

// nameAvailableDiv icon - String / Text binding
self.groupNameAvailableIcon = ko.pureComputed( function() {
	var available = self.groupNameAvailable();
	return available ? "check_circle" : "cancel"; 
});

// observable to add remove error class on group name form field - Boolean
self.groupNameError = ko.observable();

// trigger shake animation for the group name input - Boolean always notified.
self.shakeGroupNameInput = ko.observable().extend({ notify: 'always' });

// Hide guide span for the group name input - Boolean always notified.
self.hideGroupNameGuide = ko.observable().extend({ notify: 'always' });

// Tracks result of description validation - Boolean.
self.descriptionTest = ko.observable();

// Tracks checkbox state - Boolean.
self.checkbox = ko.observable(null);

// Extra observable to programatically disable submit button - Boolean
self.controlEnableSubmit = ko.observable(true);

// Enables submit button
self.enableSubmit = ko.pureComputed( function() {
	var available = self.groupNameAvailable();
	var description = self.descriptionTest();
	var control = self.controlEnableSubmit();

	// Only submit when user has valid group name and description.
	// Image upload and making private fields are optional.
	return available && description && control;

});


self.updateCheckbox = function(data, event) {
	
	//if last animation is not complete, return
	if ( $(".velocity-animating", checkboxIconDiv).length ) {
		return;
	}

	// reverse the checkbox status
	self.checkbox(!self.checkbox());	
}

self.checkDescription = function(data, event) {
	// on input - textarea

	var descriptionLength = $(event.target).val().length;
	var descriptionLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT;

	if ( !descriptionLength || descriptionLength > descriptionLimit ) {
		self.descriptionTest(false);
		return;
	}

	self.descriptionTest(true);
};


self.checkNameAvailability =  (function (){

	//closure variables to keep track of requests
	var activeRequest;
	var timer;

	return function(data, event) {
		
		//both the checks below must happen before we test for new pattern

		//check for previous incomplete request and abort it
		if (activeRequest) {
			activeRequest.abort();
		}

		//clear queued request that has not been sent
		clearTimeout(timer);

		var queryString = $.trim( $(event.target).val() );
		var pattern = constants.GROUP_NAME_REGEX;

		if (!pattern.test(queryString)) {

			// hide the name available div and set name available to false
			self.groupNameAvailable(false);
			self.showAvailability(false);
			return;
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
					var available = true;

					if (resp){
						// iterate to check in results
						for (var i=0, l=resp.length; i < l; i++) {
							if (resp[i].name.toLowerCase() === queryString.toLowerCase()) {
								// not available
								available = false;
								break;
							}
						}
					}
					// if we don't get any resp that means name is available
					
					self.groupNameAvailable(available);
					self.groupNameError(!available);
					self.showAvailability(true);			
				},

				error: function() {
					console.log("error: checkNameAvailability");
					self.groupNameAvailable(false);
				}
			});	

		}, 600) //call after xyz milli seconds

	}; //end function being returned

}());// end anon function

self.checkNameInput = function() {
	
	// If the showAvailability div is not visible(false), that means either
	// the pattern test has failed or user has no input
	
	var available = self.groupNameAvailable();
	var show = self.showAvailability();

	if ( available === false ) {

		// add error class if input is invalid/blank or group name is taken
		self.groupNameError(true);
		self.shakeGroupNameInput(true);

		if ( show ) {
			// If input is valid but group name is taken, hide guide for better UI response
			self.hideGroupNameGuide(true); 
		}		
	} else {
		// valid input and name is available; just hide the guide
		self.hideGroupNameGuide(true);
	}
}

self.createGroup = function (form) {
	
	// Check for the form submitted via 'return' key
	if (!self.enableSubmit()) {
		console.log("Inavalid submit");
		return false;
	}

	var formData = new FormData(form);
	
	//first send request to get blobstore upload url
	$.ajax({
		dataType: "json",
		url: "/ajax/get-image-upload-url",
		data: {"target_url": "/create-group"},
		
		beforeSend: function () {
			// Disable submit button
			self.controlEnableSubmit(false);
		},

		//on getting back upload url, make the next request
		success: function(uploadUrl) {
			
			if (!uploadUrl) {
				console.log("ERROR:", "unable to fetch blobstore URL");
				return;
			}

			//CREATE GROUP
			$.ajax({
			    url: uploadUrl,
			    type: 'POST',
			    data: formData,
			    cache: false,
			    contentType: false,
			    processData: false,
			    success: function(resp){
			        if (!resp) {
			        	return;
			        }

			        // Redirect to group landing page on success
			        // add delay here?
			        location.href = resp;
			    },

			    error: function(xhr) {
			    	console.log("ERROR:", "Unable to create group.", xhr.responseText);
			    }
			});//end inner ajax

		}, // end outer ajax success

		error: function() {
			console.log("ERROR:", "unable to fetch blobstore URL");
		} // end outer ajax error

	});//end ajax
}


}; // end returned function

});