requirejs.config({
    paths: { 
        /* Load jquery from cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],   
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout']
    }
});

require(
	['knockout',
	 'components/navbar_modular/navbarModViewModel',
	 'libs/simpleModals',
	 'viewmodels/groupLandingPage',
	 'libs/domReady!'],
	function(ko, navbarCompObj, simpleModals, setupGroupLandingPage) {

		//create dummy view model only to supply null 'parentRef' to navbar component
		function GroupLandingPageViewModel() {
			//set parent to null for the component usage on non-feed pages
			this.parentRef = null;
		}
		ko.components.register('navbar-modular', navbarCompObj);
		ko.applyBindings(new GroupLandingPageViewModel());

		//call the simple scripts
		simpleModals();
		setupGroupLandingPage();
	}
);