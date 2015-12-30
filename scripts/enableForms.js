
define(['jquery',
		'helper',
		'constants',
		'libs/autosize.min',
		'velocity',
		'velocity-ui'], 
function($, helper, constants, autosize, Velocity){

return {

setupLeadingImage: function(uploadModalWrapper, deleteModalWrapper, leadingImageWrapper, imageMetadata) {
	/*imageMetadata => {
		image_type: "user" or "group"
		group_id: null when image_type is "user"
		url: constants.DEFAULT_USER_IMAGE or constants.DEFAULT_GROUP_IMAGE
		navbarDataRef: navbarData reference of the userProfileViewModel
	}*/

	var uploadedImageDataURL; //data url string which user selects
	var defaultImage = imageMetadata.url;
	var leadingImage = $("img", leadingImageWrapper);
	
	var imageDeleteIcon = $(".image-delete-icon", leadingImageWrapper);
	//delete button inside confirm modal
	var deleteImageModalButtons = $("button", deleteModalWrapper);
	var closeImageDeleteModalButton = $(".simple-modal-close", deleteModalWrapper);

	var fileInput = $("input[type='file']", uploadModalWrapper);
	var fileInputTrigger = $(".file-input-trigger button", uploadModalWrapper);
	var imageSelectedWrapper = $(".image-selected-wrapper", uploadModalWrapper);
	var imagePreview = $(".image-selected", imageSelectedWrapper);
	var uploadImageButton = $("button.upload-image", uploadModalWrapper);
	var closeImageUploadModalButton = $(".simple-modal-close", uploadModalWrapper);

	var imageGuide = $(".guide", uploadModalWrapper);
	var imageGuideContent = $("span", imageGuide);

	//hide the delete icon in start if user has default image
	//only runs for grouplanding page. View profile uses visible binding
	if (leadingImage.attr("src") === defaultImage && !imageMetadata.navbarDataRef) {
		imageDeleteIcon.css("display", "none");
	}

	// attach events

	//second button in modal is for delete
	deleteImageModalButtons.eq(1).click(deleteLeadingImage);
	leadingImage.on("load", leadingImageOnload);

	fileInputTrigger.click(function() {
		fileInput.trigger("click");
	});
	fileInput.on("change", previewImage);
	closeImageUploadModalButton.click(function() {
		clearImageInput(false);
	});
	uploadImageButton.click(uploadLeadingImage);

	// ----------------- EVENT HANDLERS ----------------- //

	function uploadLeadingImage(event) {

		//stop form submission
		event.preventDefault();

		//reject blank uploads
		var files = fileInput.prop("files");
		if (!files.length) {
			return false;
		}

		var data = new FormData($("form", uploadModalWrapper)[0]);
		data.append("image_type", imageMetadata.image_type);
		data.append("group_id", imageMetadata.group_id);
		
		//first send request to get blobstore upload url
		$.ajax({
			dataType: "json",
			url: "/ajax/get-image-upload-url",
			data: {"target_url": "/ajax/upload-image"},
			
			beforeSend: function () {
				//disable upload button before sending
				uploadImageButton.prop("disabled", true);
			},

			//on getting back upload url, make the next request
			success: function(resp) {
				var uploadUrl = resp;

				//upload image
				$.ajax({
				    url: uploadUrl,
				    type: 'POST',
				    data: data,
				    cache: false,
				    contentType: false,
				    processData: false,
				    success: function(resp){
				    	// resp is updated image serving url
				        if (!resp) {
				        	return;
				        }

				        if (imageMetadata.image_type === "group") {
				        	//swap leading image displayed
				        	leadingImage.attr("src", uploadedImageDataURL);

				        	// unhide the delete icon
							imageDeleteIcon.css("display", "");
				        }

				        if (imageMetadata.image_type === "user") {
				        	imageMetadata.navbarDataRef().imageURL(resp);

				        	//delete icon unhiding is handled via ko's visible binding
				        }
				        			        				        
				        // close image upload modal
				        closeImageUploadModalButton.trigger("click");
				        
				        //clear modal for next upload
				        clearImageInput(false);
				    },

				    error: function() {
				    	console.log("ERROR:", "unable to upload image");
				    }
				});//end inner ajax

			}, // end outer ajax success

			error: function() {
				console.log("ERROR:", "unable to fetch blobstore URL");
			} // end outer ajax error

		});//end ajax
	}

	function deleteLeadingImage() {
		// return if already using default image
		if (leadingImage.attr("src") === defaultImage) {
			closeImageDeleteModal()
			return;
		}

		$.ajax({
			url: "/ajax/delete-image",
			type: "GET",
			dataType:"json",
			data: { "image_type": imageMetadata.image_type,
				    "group_id": imageMetadata.group_id },
			
			beforeSend: function () {
				//disable modal buttons
				deleteImageModalButtons.prop("disabled", true);
			},

			success: function(resp){
				if (!resp){
					return;
				}

				// on groupLandingPage use jquery to change leading image source
				if (imageMetadata.image_type === "group") {
					leadingImage.attr("src", defaultImage);

					//remove the delete image icon from controls
					imageDeleteIcon.css("display", "none");
				}

				// on view profile page update NavbarData's imageURL observable
				if (imageMetadata.image_type === "user") {
					imageMetadata.navbarDataRef().imageURL(null);

					//delete icon hiding is handled via ko's visible binding
				}

				//re-enable modal buttons
				deleteImageModalButtons.prop("disabled", false);

				//close the modal
				closeImageDeleteModal();
									
				},

			error: function(xhr) {
				console.log("ERROR:", "deleteLeadingImage");
				//re-enable buttons anyways
				deleteImageModalButtons.prop("disabled", false);
			}

		});
	}

	function leadingImageOnload() {
		//console.log("leadingImageOnload");		
	}

	function previewImage() {
		var file = fileInput.prop("files");

		if (file.length) {
			var checkFile = helper.checkImageFile(file);
			if (!checkFile.ok) {

				//clear the file input
				clearImageInput(true);

				//set and display the error/guide div
				imageGuideContent.text(checkFile.errorStr);
				showImageGuide();

				//disable upload button
				uploadImageButton.prop("disabled", true);
				return;
			}
		}

		//hide guide error message if any
		hideImageGuide();

		//preview image selected
		var reader = new FileReader();
		reader.onload = function(event) {
			
			//save the data url to use in the leading image
			uploadedImageDataURL = event.target.result;

			imageSelectedWrapper.velocity({opacity: 0}, {
				duration: 200,
				complete: function() {

					imagePreview.attr("src", event.target.result);

					//animate in new image 
					imageSelectedWrapper.velocity("transition.expandIn", {duration: 300});
					uploadImageButton.prop("disabled", false);
				}
			});
		}

		reader.readAsDataURL(file[0]);
	}

	// ----------------- HELPER FUNCTIONS ----------------- //

	function finishImageUpload() {
		// unhide the delete icon
		imageDeleteIcon.css("display", "");

        // close image upload modal
        closeImageUploadModalButton.trigger("click");
        
        //clear modal for next upload
        clearImageInput(false);
	}

	function checkDataUrl (queryString) {
		var dataUrlRegex = /^data:image\/(png|jpeg|jpg);base64/;
		return dataUrlRegex.test(queryString);
	}

	function clearImageInput(animate) {

		fileInput.wrap('<form>').closest('form').get(0).reset();
		fileInput.unwrap();

		if (!animate) {
			//this block is used on closing modal to clear image priview and input
			imagePreview.attr("src", "#void");
			uploadImageButton.prop("disabled", true);
			return;
		}

		//if some other image has been selected before, fade it out
		// and animate-in the default
		if (imagePreview.attr("src") !== "#void") {
			
			imageSelectedWrapper.velocity({opacity: 0}, {
				duration: 200,
				complete: function() {
					imagePreview.attr("src", "#void");

					imageSelectedWrapper.velocity("transition.fadeIn", {
						duration: 200
					});
				}
			});// end velocity
		}
	}


	function closeImageDeleteModal() {
		closeImageDeleteModalButton.trigger("click");
	}

	function showImageGuide() {
			if (imageGuide.css("opacity") === "0") {
					imageGuide.velocity( "transition.slideDownIn", {
					duration: 300
				});
			}
		}

	function hideImageGuide() {
		if (imageGuide.css("opacity") === "1") {
			imageGuide.velocity( "transition.slideUpOut", {
				duration: 300,
				display: null
			});
		}
	}

}, 

setupImageUploadField: function(imageWrapper, imageMetadata) {
	//imageWrapper is the jQuery Object for the .material-image-upload

	//make all selections relative to the wrapper
	var fileInput = $("input[type=file]", imageWrapper);
	var fileInputTrigger = $(".file-input-trigger", imageWrapper);
	var imagePreviewDiv = $(".image-preview", imageWrapper);
	var imagePreview = $("img", imagePreviewDiv);
	var imageName = $("span", imagePreviewDiv);
	var imageGuide = $(".guide", imageWrapper);
	var imageGuideContent = $("span", imageGuide);
	var clearInputButton = $(".file-input-clear", imageWrapper);

	var defaultImageSource = this.setDefaultImageSource(imageMetadata);
	var uploadImageFormField = imageWrapper;

	//add event handlers
	fileInputTrigger.click(function() {
		fileInput.trigger("click");
	});
	fileInput.on("change", previewImage);
	clearInputButton.click(clearImageInput);

	//event handlers
	function previewImage() {
		var file = fileInput.prop("files");

		if (file.length) {
			var checkFile = helper.checkImageFile(file);
			if (!checkFile.ok) {

				//clear the file input
				clearImageInput();

				//set and display the error/guide div
				imageGuideContent.text(checkFile.errorStr);
				showImageGuide();
				return;
			}
		}

		//hide guide error message if any
		hideImageGuide();

		//preview image selected
		var reader = new FileReader();
		reader.onload = function(event) {
			imagePreviewDiv.velocity({opacity: 0}, {
				duration: 200,
				complete: function() {
					imagePreview.attr("src", event.target.result);
					imageName.text(file[0].name);

					//animate in new image 
					imagePreviewDiv.velocity("transition.expandIn", {duration: 300});

					//also show clear image button
					showClearInputButton();
				}
			});
		}

		reader.readAsDataURL(file[0]);

		//add image selected class for valid image selection
		uploadImageFormField.addClass("image-selected");
	
	} //END previewImage

	function clearImageInput() {

		fileInput.wrap('<form>').closest('form').get(0).reset();
		fileInput.unwrap();

		//if some other image has been selected before, fade it out
		// and animate-in the default
		if (imagePreview.attr("src") !== defaultImageSource) {
			
			imagePreviewDiv.velocity({opacity: 0}, {
				duration: 200,
				complete: function() {
					imagePreview.attr("src", defaultImageSource);
					imageName.text("default");

					imagePreviewDiv.velocity("transition.expandIn", {
						duration: 300
					});
				}
			});// end velocity

		}

		//hide the clearInput button
		if (clearInputButton.css("opacity") === "1") {
			clearInputButton.velocity("transition.expandOut", {duration: 300});
		}

		//remove image selected class
		uploadImageFormField.removeClass("image-selected");	
	}

	function showImageGuide() {
			if (imageGuide.css("opacity") === "0") {
					imageGuide.velocity( "transition.slideDownIn", {
					duration: 300
				});
			}
		}

	function hideImageGuide() {
		if (imageGuide.css("opacity") === "1") {
			imageGuide.velocity( "transition.slideUpOut", {
				duration: 300,
				display: null
			});
		}
	}

	function showClearInputButton() {
		if (clearInputButton.css("opacity") === "0") {
			clearInputButton.velocity("transition.expandIn", {duration: 300})
		}
	}
},

setupNameField: function(nameWrapper, nameType) {
	//type is either "GROUP" for group name input and "DISPLAY" for display name input

	var inputFormField = nameWrapper;
	var nameInput = $("input[type=text]", nameWrapper);
	var nameGuide = $(".guide", nameWrapper);
	var pattern = constants[nameType + "_NAME_REGEX"];

	nameInput.on("blur", checkNameInput);

	function checkNameInput() {
		var name = nameInput.val();

		//when user emptys the input; remove error class and hide the guide
		if (!name) {
			inputFormField.removeClass("error");
			hideGuide();
			return;
		}

		//if input is invalid or group name is taken, add error class and animate shake
		// don't hide guide in this case
		if (!pattern.test(name) ) {	
			inputFormField.addClass("error");
			inputFormField.velocity("callout.shake", {
				duration: 500
			});
			return;
		}

		// if input is correct, just hide the guide and remove error class if there
		inputFormField.removeClass("error");
		hideGuide();
	}

	function hideGuide() {
		nameGuide.velocity("transition.slideUpOut", {
			duration: 300,
			display: null
		});
	}
},

setupDescriptionField: function(descriptionWrapper) {

	//make selections with descriptionWrapper as context
	var descFormField = descriptionWrapper;
	var textarea = $("textarea", descriptionWrapper);
	var counterSpan = $(".description-counter", descriptionWrapper);
	var descriptionGuide = $(".guide", descriptionWrapper);

	//add event handlers
	autosize(textarea);
	textarea.on("input", updateCharacterCount);
	textarea.on("blur", checkDescription);

	//event handlers
	function checkDescription() {

		var inputLength = textarea.val().length;
		var inputLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT;

		if (inputLength > inputLimit) {
			descFormField.addClass("error");
			return;
		}

		descriptionGuide.velocity("transition.slideUpOut", {
			duration: 300,
			display: null
		});
	}

	function updateCharacterCount() {
		var inputLength = textarea.val().length;
		var inputLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT;
		
		counterSpan.text(helper.getCharLeft(textarea.val()));

		if (inputLength > inputLimit) {
			descFormField.addClass("error");
		} else {
			descFormField.removeClass("error");
		}
	}

},

setupInputGuidesAndLabels: function(inputList){
	// this needs the actual input or textarea element
	inputList.on("focus", showGuide);
	inputList.on("blur", positionLabel);


	function showGuide() {
		
		//find the respective form-field and from that, the guide div
		var wrapperDiv = $(this).closest(".material-description-field, .material-name-field");
		var guideDiv = $(".guide", wrapperDiv);
		var display = "auto";

		//don't animate if already visible
		if (guideDiv.css("opacity") === "1") {
			return;
		}

		if (wrapperDiv.hasClass("material-description-field")) {
			display = "flex";
		}

		guideDiv.velocity( "transition.slideDownIn", {
			duration: 300,
			display: display
		});
	}

	function positionLabel() {
		// check if the input has any value (if we've typed into it)
	    if ($(this).val()) {
	    	$(this).addClass('has-value');
	    } else {
	    	$(this).removeClass('has-value');
	    }			
	}
},


setDefaultImageSource: function(image) {
	// image.url is either constants.DEFAULT_USER_IMAGE or 
	// constants.DEFAULT_GROUP_IMAGE;

	//image.size is the size required for preview thumbnail
	var url = image.url;
	if (image.size === 0) {
		return url;
	}

	var imageRe = /.(jpg|png|jpeg)$/;
	var index = url.search(imageRe);
    url = url.substring(0,index) + image.size + url.substring(index);

    return url;
}

}; //end returned module

}); //end define

