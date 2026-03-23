import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 })
    }

    // 文件大小限制 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 })
    }

    // 格式验证
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      return NextResponse.json({ error: '仅支持 PNG / JPEG 格式' }, { status: 400 })
    }

    const apiKey = process.env.REMOVE_BG_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: '服务未配置 API Key' }, { status: 500 })
    }

    // 调用 Remove.bg API
    const bgFormData = new FormData()
    bgFormData.append('image_file', file)
    bgFormData.append('size', 'auto')

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: bgFormData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Remove.bg error:', errText)
      return NextResponse.json({ error: '背景去除失败，请稍后重试' }, { status: 502 })
    }

    const resultBuffer = await response.arrayBuffer()
    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="removed-bg.png"',
      },
    })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
