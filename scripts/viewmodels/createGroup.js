define(['jquery',
		'enableForms',
		'constants',
		'velocity',
		'velocity-ui'], 
function($, enableForms, constants, Velocity){

return function() {

var createGroupForm = $("#createGroupForm");
var textarea = $(".material-description-field textarea");

var nameInput = $("input[type=text]", createGroupForm);
var nameAvailableDiv = $("#nameAvailable");
var naveAvailableIcon = $("#nameAvailable i");
var naveAvailableText = $("#nameAvailable span");
var nameGuide = $(".material-name-field .guide");

var privateCheckBox = $("#makePrivate input")
var checkboxIconDiv = $(".checkbox-icons");
//cache selectors for checkbox animations
var checkboxChecked = $(".checked", checkboxIconDiv);
var checkboxUnchecked = $(".unchecked", checkboxIconDiv);
var publicIcon = $("#makePrivate .status-icons .public");
var privateIcon = $("#makePrivate .status-icons .private");

var inputList = textarea.add(nameInput);
var formFields = $(".form-field");

var errorDiv = $("#error");
var displayError = $("span", errorDiv);

var imageMetadata = {
	"url": constants.DEFAULT_GROUP_IMAGE,
	"size": constants.CREATE_GROUP_IMAGE_UPLOAD_PREVIEW_IMAGE
}



var checkNameAvailability =  (function (){

	//closure variables to keep track of requests
	var activeRequest;
	var timer;

	return function(event) {
		
		//both the checks below must happen before we test for new pattern

		//check for previous incomplete request and abort it
		if (activeRequest) {
			activeRequest.abort();
		}

		//clear queued request that has not been sent
		clearTimeout(timer);

		var queryString = $.trim(event.target.value);
		var pattern = constants.GROUP_NAME_REGEX;
		var inputFormField = formFields.eq(0);

		if (!pattern.test(queryString)) {
			var display = nameAvailableDiv.css("display");	
			nameAvailableDiv.attr("data-name-available", "");

			if (display == "inline-block" || display == "block") {
				nameAvailableDiv.velocity("transition.expandOut", {
					duration: 300
				});
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
					
					if(available) {
						//set the feed back and an additional data-attribute to
						//test during form submission
						if (nameAvailableDiv.attr("data-name-available") != "yes") {
							naveAvailableText.text("Group name available");
							naveAvailableIcon.text("check_circle");
							nameAvailableDiv.attr("data-name-available", "yes");

							inputFormField.removeClass("error");
						}
						
					} else {
						
						if (nameAvailableDiv.attr("data-name-available") != "no") {
							naveAvailableText.text("Group name not available");
							naveAvailableIcon.text("cancel");
							nameAvailableDiv.attr("data-name-available", "no");

							inputFormField.addClass("error");
						}						
					}

					//only animate if not visible
					if (nameAvailableDiv.css("display") == "none"){
						nameAvailableDiv.velocity("transition.expandIn", {
							duration: 300
						});
					}			
				},

				error: function() {
					console.log("error at group text search");
					nameAvailableDiv.attr("data-name-available", "no");
				}
			});	

		}, 800) //call after xyz milli seconds

	}; //end function being returned

}());// end anon function

//events are attached here since checkNameAvailability is declared as a var
createGroupForm.submit(checkForm);

enableForms.setupInputGuidesAndLabels(inputList);
enableForms.setupDescriptionField(formFields.eq(1));
enableForms.setupImageUploadField(formFields.eq(2), imageMetadata);

//not using enableForms for name input
nameInput.on("input", checkNameAvailability);
nameInput.on("blur", checkNameInput);

checkboxIconDiv.click(updateCheckbox);

function updateCheckbox() {
	var checkboxIconShow, checkboxIconHide
	var statusIconShow, statusIconHide

	//if last animation is not complete, return
	if ( $(".velocity-animating", checkboxIconDiv).length ) {
		return;
	}

	if (privateCheckBox.prop("checked")) {
		//set the show/hide icons to be animated
		checkboxIconShow = checkboxUnchecked;
		checkboxIconHide = checkboxChecked;

		statusIconShow = publicIcon;
		statusIconHide = privateIcon;

		//change the checkbox state
		privateCheckBox.prop("checked", false);
	} else {
		checkboxIconShow = checkboxChecked;
		checkboxIconHide = checkboxUnchecked;

		statusIconShow = privateIcon;
		statusIconHide = publicIcon;

		privateCheckBox.prop("checked", true);
	}

	checkboxIconHide.velocity("transition.expandOut", {
		duration: 100,
		complete: function() {
			checkboxIconShow.velocity("transition.expandIn", {
				duration: 200,
				display: "block"
			});
		}
	});

	statusIconHide.velocity("transition.flipXOut", {
		duration: 100,
		complete: function() {
			statusIconShow.velocity("transition.flipXIn", {
				duration: 200,
				display:"block"
			});
		}
	});
	
	var makePrivateFormField = formFields.eq(3);
	if (privateCheckBox.prop("checked")) {
		makePrivateFormField.addClass("active");
	} else {
		makePrivateFormField.removeClass("active");
	}
	
}


function checkNameInput() {
	var pattern = constants.GROUP_NAME_REGEX;
	var inputFormField = formFields.eq(0);
	var materialInput = $("input", inputFormField);
	var name = nameInput.val();

	//when user emptys the input; remove error class and hide the guide
	if (!name) {
		inputFormField.removeClass("error");
		hideGuide();
		return;
	}

	//if input is invalid or group name is taken, add error class and animate shake
	// don't hide guide in this case
	if (!pattern.test(name) || (nameAvailableDiv.attr("data-name-available") == "no")) {	
		inputFormField.addClass("error");
		inputFormField.velocity("callout.shake", {
			duration: 500
		});

		if (pattern.test(name) && nameAvailableDiv.attr("data-name-available") == "no") {
			//hide the input name guide if only group name is not available
			hideGuide();
		}

		return;
	}

	// if input is correct, just hide the guide
	hideGuide();

	function hideGuide() {
		nameGuide.velocity("transition.slideUpOut", {
			duration: 300,
			display: null
		});
	}
}



function showError() {

	errorDiv.velocity("transition.expandIn", {
		duration: 300,
		complete: function() {
			errorDiv.velocity("callout.pulse", {
				duration: 300
			});
		}
	});
}

//event handlers
function checkForm(e) {

	var nameInputFormField = formFields.eq(0);
	var descFormField = formFields.eq(1);

	var name = $.trim(nameInput.val());
	var description = $.trim(textarea.val());
	var pattern = constants.GROUP_NAME_REGEX;

	var cancelSubmission = false;

	if (description.length > constants.GROUP_DESCRIPTION_CHAR_LIMIT){
		displayError.text("Group description exceeds " + constants.GROUP_DESCRIPTION_CHAR_LIMIT + " characters");
		cancelSubmission = true;
		descFormField.addClass("error");
	}

	if (description.length === 0){
		displayError.text("Group description is required.");
		cancelSubmission = true;
		descFormField.addClass("error");
	}

		if (!pattern.test(name)){
		var errorText = "Invalid group name.";

		if (name.length === 0) {
			errorText = "Group name is required.";
		}

		displayError.text(errorText);
		nameInputFormField.addClass("error");
		cancelSubmission = true;
	}

	if (nameAvailableDiv.attr("data-name-available") === "no"){
		// no need to display message here
		nameInputFormField.addClass("error");
		cancelSubmission = true;
	}


	// after all the tests check if form is to be submitted
	if (cancelSubmission) {
		e.preventDefault();
		showError();

		return false;
	}

	// submit the form if it passes all the tests
	return true; 
}


}; // end returned function

});