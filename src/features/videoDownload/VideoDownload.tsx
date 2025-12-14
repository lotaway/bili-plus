import React, { useState } from 'react'
import styled from 'styled-components'
import { downloadBiliVideo, parseVideoInfoFromUrl } from './videoDownloadUtils'

const Container = styled.div`
  padding: 20px;
  max-width: 400px;
  margin: 0 auto;
`

const Title = styled.h2`
  color: #333;
  margin-bottom: 20px;
  text-align: center;
`

const InputGroup = styled.div`
  margin-bottom: 15px;
`

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
`

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #00a1d6;
  }
`

const Button = styled.button`
  width: 100%;
  padding: 12px;
  background-color: #00a1d6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 10px;
  
  &:hover:not(:disabled) {
    background-color: #0090c5;
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

const SecondaryButton = styled(Button)`
  background-color: #6c757d;
  
  &:hover:not(:disabled) {
    background-color: #5a6268;
  }
`

const Status = styled.div<{ type: 'info' | 'success' | 'error' }>`
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
  
  ${props => {
    switch (props.type) {
      case 'success':
        return 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;'
      case 'error':
        return 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
      default:
        return 'background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;'
    }
  }}
`

const InfoBox = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  margin-top: 20px;
  font-size: 14px;
  line-height: 1.5;
`

const VideoDownload: React.FC = () => {
  const [bvid, setBvid] = useState('')
  const [cid, setCid] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null)

  const handleParseFromUrl = () => {
    const videoInfo = parseVideoInfoFromUrl()
    if (videoInfo) {
      setBvid(videoInfo.bvid)
      setCid(videoInfo.cid)
      setStatus({ type: 'info', message: `已解析: BVID=${videoInfo.bvid}, CID=${videoInfo.cid}` })
    } else {
      setStatus({ type: 'error', message: '无法从当前页面URL解析视频信息，请手动输入' })
    }
  }

  const handleDownload = async (useChromeAPI = false) => {
    if (!bvid || !cid) {
      setStatus({ type: 'error', message: '请先输入BVID和CID' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: '开始下载...' })

    try {
      await downloadBiliVideo(bvid, parseInt(cid), useChromeAPI)
      setStatus({ 
        type: 'success', 
        message: `下载完成！文件已保存到默认下载目录。\n注意：需要手动使用ffmpeg合并音视频文件。` 
      })
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: `下载失败: ${error instanceof Error ? error.message : '未知错误'}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container>
      <Title>B站视频下载</Title>
      
      {status && (
        <Status type={status.type}>
          {status.message}
        </Status>
      )}

      <InputGroup>
        <Label htmlFor="bvid">BVID:</Label>
        <Input
          id="bvid"
          type="text"
          value={bvid}
          onChange={(e) => setBvid(e.target.value)}
          placeholder="例如: BV1xx411c7mD"
        />
      </InputGroup>

      <InputGroup>
        <Label htmlFor="cid">CID:</Label>
        <Input
          id="cid"
          type="text"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder="例如: 123456789"
        />
      </InputGroup>

      <SecondaryButton 
        onClick={handleParseFromUrl}
        disabled={isLoading}
      >
        从当前页面解析
      </SecondaryButton>

      <Button 
        onClick={() => handleDownload(false)}
        disabled={isLoading}
      >
        {isLoading ? '下载中...' : '下载视频+音频'}
      </Button>

      <SecondaryButton 
        onClick={() => handleDownload(true)}
        disabled={isLoading}
      >
        {isLoading ? '下载中...' : '静默下载（使用Chrome API）'}
      </SecondaryButton>

      <InfoBox>
        <strong>使用说明：</strong>
        <br />
        1. B站使用DASH格式，音视频分离下载
        <br />
        2. 下载后得到两个文件：视频(.mp4)和音频(.m4a)
        <br />
        3. 需要手动合并：<code>ffmpeg -i video.mp4 -i audio.m4a -c copy output.mp4</code>
        <br />
        4. 静默下载需要Chrome下载权限，文件保存到默认下载目录
      </InfoBox>
    </Container>
  )
}

export default VideoDownload
