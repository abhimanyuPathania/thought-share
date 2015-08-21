requirejs.config({
    paths: { 
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout']
    }
});


require(
	['knockout',
	 'viewmodels/createGroup',
	 'components/navbar_modular/navbarModViewModel',
	 'libs/domReady!'],
	function(ko, setupCreateGroupPage, navbarCompObj) {
		
		//create dummy view model only to supply null 'parentRef' to navbar component
		function CreateGroupViewModel() {
			//set parent to null for the component usage on non-feed pages
			this.parentRef = null;
		}
		
		ko.components.register('navbar-modular', navbarCompObj);
		ko.applyBindings(new CreateGroupViewModel());

		//call the base script
		setupCreateGroupPage();
});