
requirejs.config({
    paths: { 
        /* Load libraries from cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],     
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout']
    }
});

//
require(
	['knockout',
	 'viewmodels/adminPageViewModel',
	 'libs/domReady!'],
	function(ko, AdminPageViewModel) {
    	ko.applyBindings(new AdminPageViewModel());
});

