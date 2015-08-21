
requirejs.config({
    paths: { 
        /* Load libraries from cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],     
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout'],
        'sammy': ['//cdnjs.cloudflare.com/ajax/libs/sammy.js/0.7.6/sammy.min', 'libs/sammy']
    }
});

//
require(
	['knockout',
	 'viewmodels/feedPageViewModel',
	 'components/navbar_modular/navbarModViewModel',
	 'libs/domReady!'],
	function(ko, feedPageViewModel, navbarCompObj) {
		ko.components.register('navbar-modular', navbarCompObj);
    	ko.applyBindings(new feedPageViewModel());
});

