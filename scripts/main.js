
require(
	['knockout',
	 'viewmodels/feedPageViewModel',
	 'components/request/requestViewModel',
	 'components/post/postViewModel',
	 'domReady!'],
	function(ko, feedPageViewModel, reqCompObj, postCompObj) {
		ko.components.register('request-notification', reqCompObj);
		ko.components.register('post-notification', postCompObj);
    	ko.applyBindings(new feedPageViewModel());
});