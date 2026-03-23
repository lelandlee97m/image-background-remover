export interface Env {
  REMOVE_BG_API_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
      const formData = await request.formData()
      const imageFile = formData.get('image') as File | null

      if (!imageFile) {
        return Response.json({ error: '请上传图片' }, { status: 400 })
      }

      // 文件大小限制 5MB
      if (imageFile.size > 5 * 1024 * 1024) {
        return Response.json({ error: '图片大小不能超过 5MB' }, { status: 400 })
      }

      // 格式验证
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(imageFile.type)) {
        return Response.json({ error: '仅支持 PNG / JPEG 格式' }, { status: 400 })
      }

      // 调用 Remove.bg API
      const bgFormData = new FormData()
      bgFormData.append('image_file', imageFile)
      bgFormData.append('size', 'auto')

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
        body: bgFormData,
      })

      if (!response.ok) {
        return Response.json({ error: '背景去除失败，请稍后重试' }, { status: 502 })
      }

      const resultBuffer = await response.arrayBuffer()
      return new Response(resultBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (err) {
      console.error('Worker error:', err)
      return Response.json({ error: '服务器内部错误' }, { status: 500 })
    }
  },
}
