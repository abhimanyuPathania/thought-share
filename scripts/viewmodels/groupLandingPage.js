
define(['jquery',
		'enableForms',
		'constants',
		'velocity',		
		'velocity-ui',],

function($, enableForms, constants, Velocity) {
   
return function() {

var group = JSON.parse($("#groupData").attr("data-groupJSON"));
var actionURL = {
	"join": 	   "/ajax/join-group",
	"leave": 	   "/ajax/leave-group",
	"request":     "/ajax/admin-group"
};

var actionButtons = $(".action");
actionButtons.click(doButtonAction);

if (group.allowed_to_edit) {
	var top = $(".page-content");

	var descriptionCharLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT;
	var editForm = $("#editForm");
	var descriptionFieldWrapper = $(".material-description-field", editForm);
	var textarea = $("textarea", descriptionFieldWrapper);
	var descriptionGuideWrapper = $(".guide", descriptionFieldWrapper);
	var groupDescriptionTag = $("#groupDescriptionDisplay");
	var currentDescription =  groupDescriptionTag.text();
	var counterSpan = $(".description-counter");
	var groupEditModalCloseButton = $(".simple-modal-close", editForm);
	var groupEditSaveButton = $(".save-group-edit", editForm);


	var imageDeleteModal = $("div[data-modal-id='confirmLeadingImageDeleteModal']");
	var imageUploadModal = $("div[data-modal-id='uploadImageModal']");
	var leadingImageWrapper = $(".leading-image-wrapper");
	var imageMetadata = {"url" : constants.DEFAULT_GROUP_IMAGE,
						 "image_type": "group",
						 "group_id": group.id
						}

	enableForms.setupInputGuidesAndLabels(textarea);
	enableForms.setupDescriptionField(descriptionFieldWrapper);
	enableForms.setupLeadingImage(imageUploadModal, imageDeleteModal, leadingImageWrapper, imageMetadata);
	
	editForm.submit(submitEditForm);
	counterSpan.text(descriptionCharLimit);
	groupEditModalCloseButton.click(groupEditModalRefresh);

	//enable group submit button on correct input
	textarea.on("input", function() {
		var description = $.trim(textarea.val());
		if (description.length && description.length <= descriptionCharLimit) {
			groupEditSaveButton.prop("disabled", false);
		} else {
			groupEditSaveButton.prop("disabled", true);
		}
	});
};

function groupEditModalRefresh() {
	//reset textarea
	editForm[0].reset();

	//reset the label
	textarea.removeClass("has-value");

	//remove error and hide guide
	if (descriptionFieldWrapper.hasClass("error")) {
		descriptionFieldWrapper.removeClass("error");
		descriptionGuideWrapper.css("opacity", 0);
	}
	
	//reset counter
	counterSpan.text(descriptionCharLimit);

	//disable the edit save button
	groupEditSaveButton.prop("disabled", true);

	//reset textarea height
	textarea.css("height", "");
}

function submitEditForm(e){
	e.preventDefault();

	var description = $.trim(textarea.val());
	// invalid input close modal and return
	if (!description.length || description.length > descriptionCharLimit || 
		(description === currentDescription)) {
		
		groupEditModalCloseButton.trigger("click");
		groupEditModalRefresh();
		return false;
	}

	$.ajax({
		url: "/ajax/edit-group",
		type: "GET",
		dataType: "json",
		data: {description: description,
				group_id: group.id
			},

		beforeSend: function() {
			groupEditSaveButton.prop("disabled", true);
		},

		success: function(resp) {
			if (!resp) {
				return;
			}

			//update group description displayed
			groupDescriptionTag.text(description);

			//update current description variable
			currentDescription = description;

			//close group edit modal
			groupEditModalCloseButton.trigger("click");

			//scroll to top to show updated description
			top.velocity("scroll", {
				duration: 700,
				offset: -50
			});

			//refresh modal for next edit
			groupEditModalRefresh();
		},

		error: function() {
			console.log("ERROR:", "submitEditForm");
		}
	});
	
}

function doButtonAction() {
	var button = $(this);
	var clickAction = button.attr("data-click-action");

	$.ajax({
		url: actionURL[clickAction],
		type: "GET",
		dataType: "json",
		data: {group_id: group.id},

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
					var element = '<span class="status-message hidden">Join request sent.</span>'
					replaceActionButton(button, element);
				}
			}

			if (clickAction == "request"){
				var element = '<span class="status-message hidden">Adminship request sent.</span>'
				replaceActionButton(button, element);
				//button.text("Adminship request sent.");
			}
		},

		error: function(){
			console.log("ERROR:", "doButtonAction");
		}
		
	});
}

function replaceActionButton(button, replacement) {
	button.velocity("transition.expandOut", {
		duration: 200,
		complete: function() {
			button.replaceWith(replacement);
			var statusMessageSpan = $("span.status-message.hidden");
			statusMessageSpan.velocity("transition.expandIn", {
				duration: 300,
				display: "inline-flex",
				complete: function() {
					statusMessageSpan.removeClass("hidden");
				}
			});
		}
	});
}


};// end anon function that will be returned

}); // end define function
