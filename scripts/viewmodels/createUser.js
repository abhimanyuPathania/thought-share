define(['jquery',
		'helper',
		'constants'], 
function($, helper, constants){

return function() {

var createUserForm = $("#createUserForm");
var displayNameInput = $("input[type=text]", createUserForm);
var file = $("input[type=file]", createUserForm).prop("files");
var error = $("#error");

createUserForm.submit(checkForm);

function checkForm(event) {
	var displayName = $.trim(displayNameInput.val());
	var pattern = constants.DISPLAY_NAME_REGEX;
	var cancelSubmission = false;

	if (pattern.test(displayName) === false) {
		error.text("Invalid display name");
		cancelSubmission = true;
	}

	if (!displayName) {
		error.text("Display Name cannot be blank");
		cancelSubmission = true;
	}

	if (file.length > 1){
		error.text("Please upload only one image");
		cancelSubmission = true;
	}

	if (file.length) {
		var checkFile = helper.checkImageFile(file);
		if (!checkFile.ok) {
			error.text(checkFile.errorStr);
			cancelSubmission = true;
		}
	}

	// after all the tests check if form is to be submitted
	if (cancelSubmission) {
		event.preventDefault();
		return false;
	}

	// submit the form if it passes all the tests
	return true; 

}// end checkForm

}; // end returned function

}); // end define