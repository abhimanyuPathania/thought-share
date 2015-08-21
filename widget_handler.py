from google.appengine.ext import ndb

from utility_handler import Handler
from models import Group

from constants import HOT_GROUPS_WIDGET_LIMIT

class HotGroupsHandler(Handler):
	# /ajax/widget/hot-groups

	def get(self):
		if not self.account:
			return self.fail_ajax()

		q = Group.query()
		q = q.order(-Group.members_number)
		group_list = q.fetch(limit = HOT_GROUPS_WIDGET_LIMIT)

		if not group_list:
			return self.render_json(None)

		hot_groups = []
		for group in group_list:
			group_dict = group.to_dict(include = ["name", "cover_image_url", "members_number"])
			group_dict["id"] = group.key.id()
			hot_groups.append(group_dict)

		return self.render_json(hot_groups)