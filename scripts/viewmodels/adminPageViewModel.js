
define(['knockout',
		'jquery',
		'helper',
		'constants'],
function(ko, $, helper, constants) {
   
return function AdminPageViewModel() {
	var self = this;

	var hardResetButton = $("#hard-reset-button");
	var hardResetMessageString = "Hard Reset Success";

	self.hardResetMessage = ko.observable();

	self.executeHardReset = function(){
		var hardResetMessage = "Proceed?\n(This deletes everything.)"
		var executeReset = confirm(hardResetMessage);

		if(executeReset){
			//first send request to get blobstore upload url

			$.ajax({
				dataType: "json",
				type: "GET",
				url: "/admin/ajax/hard-reset",

				beforeSend: function () {
					hardResetButton.prop("disabled", true);
					self.hardResetMessage(null);
				},

				
				success: function(message) {
					console.log(message);
					hardResetButton.prop("disabled", false);
					self.hardResetMessage(hardResetMessageString);
				}, 

				error: function() {
					hardResetButton.prop("disabled", false);
					self.hardResetMessage("Unable to perform Hard Reset");
					console.log("ERROR:", "Unable to perform Hard Reset");
				} 

			});//end ajax
		}

	}
}; // end view model

}); // end define function