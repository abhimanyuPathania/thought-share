define(['jquery',
		'knockout',
		'enableForms',
		'helper',
		'constants',
		'velocity',
		'velocity-ui'], 
function($, ko, enableForms, helper, constants, Velocity){

return function CreateUserViewModel() {

var self = this;

var createUserForm = $("#createUserForm");
var displayNameInput = $("input[type=text]", createUserForm);
var fileInput = $("input[type=file]", createUserForm);
var displayNamePattern = constants.DISPLAY_NAME_REGEX;

var imageMetadata = {
	"url": constants.DEFAULT_USER_IMAGE,
	"size": constants.CREATE_USER_IMAGE_UPLOAD_PREVIEW_IMAGE
}

self.displayName = ko.observable();
self.displayNameTest = ko.observable();
self.enableSubmit = ko.observable(false);
self.displayName.subscribe(checkDisplayName);

enableForms.setupInputGuidesAndLabels(displayNameInput);
enableForms.setupImageUploadField($("#imageField"), imageMetadata);
enableForms.setupNameField($(".material-name-field"), "DISPLAY");


self.createUser = function (form) {
	
	var image = fileInput.prop("files");
	var data = new FormData(createUserForm[0]);

	// Check for the form submitted via 'return' key
	if (!self.enableSubmit()) {
		console.log("inavalid submit");
		return false;
	}

	//first send request to get blobstore upload url
	$.ajax({
		dataType: "json",
		url: "/ajax/get-creating-account-url",
		data: {"target_url": "/"},
		
		beforeSend: function () {
		},

		//on getting back upload url, make the next request
		success: function(uploadUrl) {
			
			if (!uploadUrl) {
				console.log("ERROR:", "unable to fetch blobstore URL");
				return;
			}

			console.log("uploadUrl", uploadUrl);

			//CREATE USER
			$.ajax({
			    url: uploadUrl,
			    type: 'POST',
			    data: data,
			    cache: false,
			    contentType: false,
			    processData: false,
			    success: function(resp){
			        if (!resp) {
			        	return;
			        }

			        // add delay here?
			        location.href = "/feed";
			    },

			    error: function(xhr) {
			    	console.log("ERROR:", "Unable to create user account.", xhr.responseText);
			    }
			});//end inner ajax

		}, // end outer ajax success

		error: function() {
			console.log("ERROR:", "unable to fetch blobstore URL");
		} // end outer ajax error

	});//end ajax
}

self.logoutUser = function(data, event) {
	var logoutUrl = $(event.target).attr("data-logout-url"); 
	location.href = logoutUrl;
}

function checkDisplayName () {
	var displayName = $.trim(self.displayName());

	// update the observable
	self.enableSubmit( displayNamePattern.test(displayName) );
}

}; // CreateUserViewModel

}); // end define