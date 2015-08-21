
requirejs.config({
    paths: { 
        /* Load jquery from google cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],
       
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout'],
        'sammy': ['//cdnjs.cloudflare.com/ajax/libs/sammy.js/0.7.6/sammy.min', 'libs/sammy']
    }
});

//
require(
	['knockout',
	 'viewmodels/feedPageViewModel',
	 'components/request/requestViewModel',
	 'components/post/postViewModel',
	 'components/search/searchViewModel',
	 'navbar',
	 'libs/domReady!'],
	function(ko, feedPageViewModel, reqCompObj, postCompObj, searchCompObj, navbar) {
		ko.components.register('request-notification', reqCompObj);
		ko.components.register('post-notification', postCompObj);
		ko.components.register('group-search', searchCompObj);
    	ko.applyBindings(new feedPageViewModel());

    	//intialize navbar after registering components, since registering is synchronous
    	navbar.init();
});

