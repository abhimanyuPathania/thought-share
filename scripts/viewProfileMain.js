requirejs.config({
    paths: { 
        /* Load libraries from cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],   
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout'],
        'sammy': ['//cdnjs.cloudflare.com/ajax/libs/sammy.js/0.7.6/sammy.min', 'libs/sammy'],
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
	 'libs/simpleModals',
	 'viewmodels/userProfileViewModel',
	 'components/navbar_modular/navbarModViewModel',
	 'components/hot_groups/hotGroupsViewModel',
	 'libs/domReady!'],
	function(ko, simpleModals, userProfileViewModel, navbarCompObj, hotGroupsCompObj) {

		ko.components.register('navbar-modular', navbarCompObj);
		ko.components.register('hot-groups', hotGroupsCompObj);

		simpleModals();
    	ko.applyBindings(new userProfileViewModel());
});