/**
 * Copy for the landmark gallery. Registered into the Client locale service
 * under the `landmarks3d` namespace; both built-in locales are supplied so a
 * locale switch never falls back to a raw key.
 */
export const LOCALE_NAMESPACES = {
  en: {
    'panel.title': 'Landmark studio',
    'panel.subtitle': 'Four monuments, rebuilt as real-time 3D models',
    'panel.hint': 'Drag to orbit · scroll to zoom · double-click to reset',
    'panel.error': 'This model could not be built.',
    'panel.reset': 'Reset view',
    'panel.rotate': 'Auto-rotate',
    'panel.triangles': 'triangles',
    'panel.height': 'height',
    'eiffel.name': 'Eiffel Tower',
    'eiffel.place': 'Paris, France',
    'eiffel.blurb':
      'Three tiers of wrought iron over four splayed arches — the silhouette that has stood in for Paris since 1889.',
    'wall.name': 'Great Wall',
    'wall.place': 'Badaling, China',
    'wall.blurb':
      'A crenellated parapet riding a mountain ridge, punctuated by square watchtowers that carried beacon fires.',
    'forbidden-city.name': 'Forbidden City',
    'forbidden-city.place': 'Beijing, China',
    'forbidden-city.blurb':
      'Vermilion walls and imperial yellow hip roofs around the Hall of Supreme Harmony, raised on a white marble terrace.',
    'taj-mahal.name': 'Taj Mahal',
    'taj-mahal.place': 'Agra, India',
    'taj-mahal.blurb':
      'A marble onion dome flanked by four minarets, mirrored in a long reflecting pool on the river terrace.',
  },
  zh: {
    'panel.title': '地标工坊',
    'panel.subtitle': '四座名迹，以实时 3D 模型重建',
    'panel.hint': '拖动旋转 · 滚轮缩放 · 双击复位',
    'panel.error': '该模型构建失败。',
    'panel.reset': '复位视角',
    'panel.rotate': '自动旋转',
    'panel.triangles': '三角面',
    'panel.height': '高度',
    'eiffel.name': '埃菲尔铁塔',
    'eiffel.place': '法国 · 巴黎',
    'eiffel.blurb': '四道外张的拱与三层锻铁结构——自 1889 年起，这个剪影就是巴黎的代词。',
    'wall.name': '中国长城',
    'wall.place': '中国 · 八达岭',
    'wall.blurb': '垛口沿山脊起伏蜿蜒，方形敌楼依次矗立，曾用于传递烽火。',
    'forbidden-city.name': '紫禁城',
    'forbidden-city.place': '中国 · 北京',
    'forbidden-city.blurb': '朱墙黄瓦环绕太和殿，殿身坐落在汉白玉三层须弥座上。',
    'taj-mahal.name': '泰姬陵',
    'taj-mahal.place': '印度 · 阿格拉',
    'taj-mahal.blurb': '白色大理石洋葱穹顶与四座宣礼塔，倒映在河阶上的长形水池之中。',
  },
};
