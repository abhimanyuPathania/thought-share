import logging
import time
import json

from google.appengine.api import memcache
from google.appengine.ext import ndb

from utility_handler import Handler
from models import User, Group

from helper_operations import get_group_data

class FeedHandler(Handler):
	def get(self):
		if not self.account:
			return self.redirect('/')

		user = self.user_key.get()

		# add user's groups to undisplayed span's data-grouJSON attribute
		# this is required for the client side routing to works
		groups_list = get_group_data(user.groups, ['name', 'private'])
		group_json = json.dumps(groups_list)

		# add user's data from client side user object
		user_data = user.to_dict(exclude = ['image_blob', 'admin_groups', 'groups'])
		user_data['id'] = self.user_id
		user_json = json.dumps(user_data)

		return self.render('feed.html', display_name = user.display_name,
										group_json = group_json,
										user_json = user_json)

class GetUserGroupsHandler(Handler):
	def get(self):
		if not self.account:
			return None

		user = User.get_by_id(self.user_id)
		groups_joined = ndb.get_multi(user.groups)
		group_list = []

		for g in groups_joined:
			temp = {}
			temp["name"] = g.name
			temp["id"] = g.key.id()
			group_list.append(temp)

		self.render_json(group_list)