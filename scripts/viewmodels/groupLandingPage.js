
define(['jquery', 'helper', 'constants'], function($, helper, constants) {
   
return function() {

var group = JSON.parse($("#groupData").attr("data-groupJSON"));
var descriptionCharLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT;
var actionURL = {
	"join": 	   "/ajax/join-group/" + group.id,
	"leave": 	   "/ajax/leave-group/" + group.id,
	"request":     "/ajax/admin-group/" + group.id,
	"editgroup":   "/edit-group/" + group.id
};

var actionButtons = $(".action");
var editForm = $("#editForm");
actionButtons.click(doButtonAction);

// if the page has a group edit form
if (editForm.length) {
	var textarea = $("textarea", editForm);
	var counterSpan = $("#descCount");
	var deleteImageButton = $("#deleteImage");

	// attach the submit handler for client side checking
	editForm.submit(submitEditForm);
	textarea.on("keyup", updateCharacterCount);
	
	// add additional function to modal trigger for clearing form/error fields
	$("button.simple-modal-trigger").click(function(){
		editForm[0].reset();
		$("#error", editForm).text("");
		counterSpan.text(descriptionCharLimit);
	});

	//
	if (deleteImageButton.length) {
		deleteImageButton.click(deleteGroupImage);
	}
}


function deleteGroupImage() {
	var error = $("#error", this);

	$.ajax({
		url: "/ajax/delete-image",
		type: "POST",
		dataType:"json",
		data:{"image_type": "group",
			  "group_id": group.id
			},
		success: function(resp){
			if (!resp){
				return false;
			}

			// update the group image elements on the page and close model
			console.log("image deleted");

			$("img.group-cover-image").attr("src", "../images/defaults/group.png");
			$("button.simple-modal-close", editForm).triggerHandler("click");

			//update the default image message and remove the delete image button
			$("#defaultImageMessage").text("None set. Using default");
			$("#deleteImage").remove();

			return;
		},

		error: function(xhr) {
			error.text("something went wrong, please try later");
			return false;
		}


	});
}


function submitEditForm(e){

	var description = $.trim(textarea.val());
	var file = $("input[type=file]", this).prop("files");
	var error = $("#error", this);
	var cancelSubmission = false;

	if (!(description || file.length)){
		// blank submission
		cancelSubmission = true;
		error.text("Atleast enter a description or choose an image");
	}

	if (file.length > 1) {
		cancelSubmission = true;
		error.text("Please select only one image");
	}

	if (description.length > descriptionCharLimit) {
		cancelSubmission = true;
		error.text("description exceeds"+ descriptionCharLimit +"characters");
	}

	if (file.length){
		var checkFile = helper.checkImageFile(file);
		if (!checkFile.ok) {
			error.text(checkFile.errorStr);
			cancelSubmission = true;
		}
	}

	if (cancelSubmission) {
		e.preventDefault();
		return false;
	}

	// send the form
	return true;
}

function doButtonAction() {
	var button = $(this);
	var clickAction = button.attr("data-click-action");

	$.ajax({
		url: actionURL[clickAction],
		type: "GET",
		dataType: "json",

		beforeSend: function(){
			button.prop("disabled", true);
		},

		success:function(data){

			if (clickAction === "leave"){
				return window.location = "/feed";
			}

			if (clickAction === "join"){
				if (!group["private"]){
					// do a server reload if group is public
					window.location.reload(true);
				} else{
					//display the message
					button.text("Join request sent");
				}
			}

			if (clickAction == "request"){
				button.text("Adminship request sent");
			}
		},

		error: function(){
			console.log("something went wrong");
		},

		complete: function(xhr) {
			if (xhr.status === 200) {
				if(clickAction === "request" ||(clickAction === "join" && group["private"])){
					//don't re-enable the button; just return
					return;
				}
			}

			//other wise re-enable the button
			button.prop("disabled", false);
		}
	});
}

function updateCharacterCount() {
	counterSpan.text(helper.getCharLeft(textarea.val())); 
}

};// end anon function that will be returned

}); // end define function
