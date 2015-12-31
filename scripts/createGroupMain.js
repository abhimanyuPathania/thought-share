requirejs.config({
    paths: { 
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
	 'viewmodels/createGroup',
	 'components/navbar_modular/navbarModViewModel',
	 'libs/domReady!',
	 'custom_bindings/createGroupCustomBindings'],
	function(ko, CreateGroupViewModel, navbarCompObj) {
		
		ko.components.register('navbar-modular', navbarCompObj);
		ko.applyBindings(new CreateGroupViewModel());
});