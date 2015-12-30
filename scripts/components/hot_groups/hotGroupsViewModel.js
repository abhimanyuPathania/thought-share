define(['knockout',
		'jquery',
		'helper',
		'constants',
		'libs/text!components/hot_groups/hotGroupsTemplate.html'],
function(ko, $, helper, constants, htmlString) {

function HotGroupsViewModel() {
	var self = this;

	self.hotGroups = ko.observable();
	getHotGroups();

	function getHotGroups(){
		$.ajax({
			url: "/ajax/widget/hot-groups",
			type: "GET",
			dataType: "json",

			success: function(resp){
				if(!resp || resp.length === 0){
					return;
				}

				var groupsArray = [];
				for (var i=0, len=resp.length; i<len; i++){
					groupsArray.push(new HotGroup(resp[i]));
				}

				self.hotGroups(groupsArray);
			},

			error: function(){
				console.log("ERROR", "getHotGroups");
			}
		});
	}

	function HotGroup(g){
		this.name = g.name;
		this.url = "/group/" + g.id;
		this.membersNumber = g.members_number;
		this.membersText = (function(){
			var num = g.members_number;
			return (num === 1 ? num + " member" : num + " members");
		}());
		
		this.imageURL = g.cover_image_url;
		this.thumbURL = helper.getImageURL(g.cover_image_url,
										   constants.HOT_GROUPS_IMAGE,
										   "group");
		
	}

}; //end view model
 
	// Return component definition, this is used in main.js
	return { viewModel: HotGroupsViewModel, template: htmlString };

});