import cv2
import numpy as np

def generate_lines(points):
    """
    接收任意数量的点位 list，返回首尾相连的线 list。
    """
    num_points = len(points)
    if num_points < 2:
        return []

    lines_list = []
    for i in range(num_points):
        start_point = points[i]
        end_point = points[(i + 1) % num_points]
        lines_list.append((start_point, end_point))

    return lines_list

def draw_lines(path, points_list, mode=None):
    """
    在指定图片上绘制多组线条或涂黑多边形区域
    points_list: list of list of points, e.g. [[(x1,y1), ...], [(x2,y2), ...]]
    mode: "内部" - 保留多边形内部，涂黑外部
          "外部" - 涂黑多边形内部，保留外部
          None - 仅绘制多边形边框（默认，向后兼容）
    """
    if not points_list:
        return path
        
    img = cv2.imread(path)
    if img is None:
        print(f"Warning: Failed to read image at {path}")
        return path

    try:
        if mode is None:
            # 模式1：仅绘制多边形边框（向后兼容）
            for points in points_list:
                # 确保 points 是列表
                if not isinstance(points, list):
                    continue
                    
                lines = generate_lines(points)
                for start, end in lines:
                    # 转换坐标为整数，防止cv2报错
                    try:
                        start_pt = (int(start[0]), int(start[1]))
                        end_pt = (int(end[0]), int(end[1]))
                        cv2.line(img, start_pt, end_pt, (0, 0, 255), 2, cv2.LINE_AA)
                    except (ValueError, IndexError, TypeError):
                        continue
        else:
            # 模式2：涂黑多边形内部或外部
            # 1. 创建一个与原图大小相同的纯黑遮罩 (单通道)
            mask = np.zeros(img.shape[:2], dtype=np.uint8)
            
            # 2. 将多边形坐标列表转换为 OpenCV 需要的 numpy 数组格式
            # 注意：cv2.fillPoly 需要的格式是 list of numpy arrays, 且类型为 int32
            valid_polygons = []
            for points in points_list:
                if isinstance(points, list) and len(points) >= 3:
                    try:
                        # 转换坐标为整数
                        poly_int = [(int(x), int(y)) for x, y in points]
                        valid_polygons.append(poly_int)
                    except (ValueError, TypeError):
                        continue
            
            if valid_polygons:
                pts = [np.array(poly, np.int32) for poly in valid_polygons]
                
                # 3. 在遮罩上将多边形内部填充为纯白 (255)
                cv2.fillPoly(mask, pts, 255)
                
                # 4. 根据模式应用遮罩
                if mode == "内部":
                    # 模式"内部"：保留白色区域（多边形内），外部全黑
                    # bitwise_and 会根据 mask 的白色区域保留原图，黑色区域变黑
                    result_img = cv2.bitwise_and(img, img, mask=mask)
                elif mode == "外部":
                    # 模式"外部"：保留黑色区域（多边形外），内部全黑
                    # 我们需要先反转遮罩：把多边形内部变黑，外部变白
                    mask_inv = cv2.bitwise_not(mask)
                    result_img = cv2.bitwise_and(img, img, mask=mask_inv)
                else:
                    raise ValueError("mode 参数必须是 '内部' 或 '外部'")
                
                img = result_img
        
        cv2.imwrite(path, img)
    except Exception as e:
        print(f"Error drawing lines: {e}")
        
    return path
