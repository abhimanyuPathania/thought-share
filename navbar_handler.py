
from google.appengine.api import users

from utility_handler import Handler
#from models import User

class NavbarHandler(Handler):
	# /ajax/get-navbar-data
	def get(self):
		if not self.account:
			return self.fail_ajax()

		user = self.user_key.get()
		navbar_data = user.to_dict(exclude = ['image_blob', 'admin_groups', 'groups'])
		navbar_data["logout_url"] = users.create_logout_url('/')

		return self.render_json(navbar_data)