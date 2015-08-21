define(['jquery',
		'helper',
		'constants'], 
function($, helper, constants){

return function() {

var createGroupForm = $("#createGroupForm");
var textarea = $("textarea", createGroupForm);
var counterSpan = $("#descCount");
var nameInput = $("input[type=text]", createGroupForm);
var availableSpan = $("#nameAvailable");

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
		
		if (!pattern.test(queryString)) {
			availableSpan.text("");
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
						availableSpan.text("Group name available");
						availableSpan.attr("data-name-available", "yes");
					} else {
						availableSpan.text("Group name not available");
						availableSpan.attr("data-name-available", "no");
					}
					
				},

				error: function() {
					console.log("error at group text search");
					availableSpan.text("");
					availableSpan.attr("data-name-available", "no");
				}
			});	

		}, 800) //call after xyz milli seconds

	}; //end function being returned

}());// end anon function

//events are attached here since checkNameAvailability is declared as a var
createGroupForm.submit(checkForm);
textarea.on("keyup", updateCharacterCount);
nameInput.on("keyup", checkNameAvailability);



//event handlers
function checkForm(e) {
	var name = $.trim(nameInput.val());
	var description = $.trim(textarea.val());
	var file = $("input[type=file]", this).prop("files");
	var error = $("#error", this);
	var pattern = constants.GROUP_NAME_REGEX;

	var cancelSubmission = false;
	// both name and description are missing
	if (!(name && description)){
		error.text("Name and Description cannot be left empty");
		cancelSubmission = true;
	}

	if (availableSpan.attr("data-name-available") === "no"){
		// no need to display message here
		cancelSubmission = true;
	}

	if (!pattern.test(name)){
		error.text("Invalid group name");
		cancelSubmission = true;
	}


	if (description.length > constants.GROUP_DESCRIPTION_CHAR_LIMIT){
		error.text("Group description exceeds" + constants.GROUP_DESCRIPTION_CHAR_LIMIT + "characters");
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
		e.preventDefault();
		return false;
	}

	// submit the form if it passes all the tests
	return true; 
}

function updateCharacterCount() {
	counterSpan.text(helper.getCharLeft(textarea.val())); 
}

}; // end returned function

});