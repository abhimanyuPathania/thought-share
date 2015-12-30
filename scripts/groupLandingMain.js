requirejs.config({
    paths: { 
        /* Load jquery from cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],   
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout'],
        'velocity': ['//cdn.jsdelivr.net/velocity/1.2.2/velocity.min', 'libs/velocity'],
        'velocity-ui': ['//cdn.jsdelivr.net/velocity/1.2.2/velocity.ui.min', 'libs/velocity-ui']
    },

    shim: {
        "velocity": {
            deps: [ "jquery" ]
        },

        "velocity-ui": {
            deps: [ "velocity" ]
        }
    }
});

require(
	['knockout',
	 'components/navbar_modular/navbarModViewModel',
	 'components/hot_groups/hotGroupsViewModel',
	 'libs/simpleModals',
	 'viewmodels/groupLandingPage',
	 'libs/domReady!'],
	function(ko, navbarCompObj, hotGroupsCompObj, simpleModals, setupGroupLandingPage) {

		//create dummy view model only to supply null 'parentRef' to navbar component
		function GroupLandingPageViewModel() {
			//set parent to null for the component usage on non-feed pages
			this.parentRef = null;
		}
		ko.components.register('navbar-modular', navbarCompObj);
		ko.components.register('hot-groups', hotGroupsCompObj);
		ko.applyBindings(new GroupLandingPageViewModel());

		//call the simple scripts
		simpleModals();
		setupGroupLandingPage();
	}
);