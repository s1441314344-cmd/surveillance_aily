class Point:
    def __init__(self, code, name, link, rule_id=None, location=None, record_id=None):
        self.code = code
        self.name = name
        self.link = link
        self.rule_id = rule_id
        self.location = location
        self.record_id = record_id
        self.key_frames = "关闭"
        self.frequency = 30
        self.detection_points = []
        self.status = "有效"

    def to_dict(self):
        return {
            'code': self.code,
            'name': self.name,
            'link': self.link,
            'rule_id': self.rule_id,
            'location': self.location,
            'key_frames': self.key_frames,
            'frequency': self.frequency,
            'detection_points': self.detection_points,
            'status': self.status
        }