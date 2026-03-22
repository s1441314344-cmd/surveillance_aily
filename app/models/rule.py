class Rule:
    def __init__(self, code, name, detect_type=None, params=None, record_id=None):
        self.code = code
        self.name = name
        self.detect_type = detect_type
        self.params = params
        self.record_id = record_id
        self.classes = []
        self.threshold = 0.25

        self._parse_params()

    def _parse_params(self):
        if not self.params:
            self.classes = []
            return

        try:
            import ast
            if isinstance(self.params, str):
                parsed = ast.literal_eval(self.params)
            else:
                parsed = self.params

            if isinstance(parsed, dict):
                self.classes = parsed.get('classes', [])
                self.threshold = parsed.get('threshold', 0.25)
            elif isinstance(parsed, list):
                self.classes = parsed
        except:
            self.classes = []

    def to_dict(self):
        return {
            'code': self.code,
            'name': self.name,
            'detect_type': self.detect_type,
            'params': self.params,
            'classes': self.classes,
            'threshold': self.threshold
        }