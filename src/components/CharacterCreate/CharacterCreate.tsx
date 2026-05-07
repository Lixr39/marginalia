import { useState } from 'react'
import type { Character } from '../../types'
import { getLLMConfig, generateId, saveCustomCharacter } from '../../store'
import { chatCompletion } from '../../services/llm'
import './CharacterCreate.css'

interface Props {
  onSave: (char: Character) => void
  onClose: () => void
  editChar?: Character // 编辑模式
}

type CreateMode = 'manual' | 'import'

const AVATAR_OPTIONS = ['🌟', '🦋', '🐺', '🦊', '🐉', '🌙', '☀️', '⚡', '🎭', '🗡️',
  '🧊', '🌊', '🔮', '🎪', '🌺', '🍀', '🦅', '🐍', '🌸', '💎']

const EXTRACT_PROMPT = `你是一个角色分析师。用户将提供一份角色相关的材料（可能是小说片段、角色设定文档、对话记录、同人文、wiki资料等）。从材料中提取以下五个维度，生成一份结构化角色档案。

【维度一：说话风格】
- 句子长短倾向（短句多？长句多？碎句？）
- 常用词汇和口癖（具体列举，如"见鬼"、"那群蠢货"、"随便"）
- 语气特征（嘲讽？温柔？冷淡？激动？轻描淡写？）
- 标点符号习惯（感叹号多？省略号多？破折号？几乎不用标点？）
- 特定称呼方式（对特定对象的叫法，如有）

【维度二：性格内核】
- 最在意的事物（自由？权力？某个人？尊严？）
- 最害怕的事物
- 矛盾点（外在表现和内在需求的冲突——这是角色最有意思的地方）

【维度三：核心价值体系】
- 相信什么（世界观、信条）
- 反对什么
- 对"爱"的理解
- 对弱者的态度
- 道德底线在哪里

【维度四：相处模式】
- 对亲近的人 vs 外人，说话方式有何不同
- 表达关心的方式（直说？用行动？绕弯子？）
- 被戳到痛处时的反应模式
- 示弱的方式（若有的话）

【维度五：思考方式】
- 分析问题的切入角度（感性直觉？逻辑推理？经验主义？）
- 会引用什么类型的东西佐证观点（哲学？军事？自然现象？历史？）
- 核心偏见（他看世界的滤镜——每个人都有）

提取注意事项：
- 严格区分【角色本质特征】和【特定关系中的行为】。若材料里角色对某人特别温柔，须标注"对[特定对象]会表现出温柔，但本质性格是[冷硬/骄傲/…]"，不要把特殊关系里的行为当成通用性格
- 若材料中有明确的哲学立场、世界观或对特定议题的看法，逐条提取作为哲学立场；若无，基于已有信息合理推断并注明"（推断）"
- 信息不足的维度用"（材料未体现，推测为……）"标注，不要凭空编造

输出格式（JSON，不要其他内容）：
{
  "name": "角色名（从材料提取）",
  "label": "性格标签，2-4字",
  "avatar": "最符合角色气质的一个emoji",
  "description": "一句话简介，15字以内",
  "systemPrompt": "将以上维度整合成连贯的角色prompt正文，格式如下：\\n你是[名字]。\\n\\n【说话风格】\\n…（列出具体口癖、句式、语气、标点习惯）\\n\\n【性格内核】\\n最在意：…\\n最害怕：…\\n矛盾点：…\\n\\n【价值观】\\n相信：…\\n反对：…\\n对爱的理解：…\\n对弱者的态度：…\\n道德底线：…\\n\\n【相处模式】\\n…（含本质特征与特定关系行为的区分说明）\\n\\n【思维方式】\\n切入角度：…\\n引用偏好：…\\n核心偏见：…\\n\\n【哲学立场】\\n…（逐条列出，或注明为推断）"
}`

export default function CharacterCreate({ onSave, onClose, editChar }: Props) {
  const [mode, setMode] = useState<CreateMode>(editChar ? 'manual' : 'manual')

  // Manual fields
  const [name, setName] = useState(editChar?.name || '')
  const [label, setLabel] = useState(editChar?.label || '')
  const [avatar, setAvatar] = useState(editChar?.avatar || '🌟')
  const [avatarIsImage, setAvatarIsImage] = useState(() => !!editChar?.avatar && !editChar.avatar.match(/\p{Emoji}/u) && editChar.avatar.startsWith('data:'))
  const [description, setDescription] = useState(editChar?.description || '')
  const [systemPrompt, setSystemPrompt] = useState(editChar?.systemPrompt || '')
  const [enableActions, setEnableActions] = useState(editChar?.enableActions ?? false)

  // Import fields
  const [docText, setDocText] = useState('')
  const [skipGuided, setSkipGuided] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  // Guided questions (when not skipping)
  const [guidedStyle, setGuidedStyle] = useState('')
  const [guidedStance, setGuidedStance] = useState('')

  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setAvatar(dataUrl)
      setAvatarIsImage(true)
      setShowAvatarPicker(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleExtract() {
    if (!docText.trim()) return
    const config = getLLMConfig()
    if (!config) { setExtractError('请先配置 API'); return }

    setExtracting(true)
    setExtractError('')

    try {
      let prompt = docText
      if (!skipGuided && (guidedStyle.trim() || guidedStance.trim())) {
        prompt += '\n\n【用户补充信息】\n'
        if (guidedStyle.trim()) prompt += `说话风格补充：${guidedStyle}\n`
        if (guidedStance.trim()) prompt += `核心立场补充：${guidedStance}\n`
      }

      const raw = await chatCompletion(config, [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: prompt },
      ])

      // Parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('解析失败，请重试')
      const parsed = JSON.parse(jsonMatch[0])

      setName(parsed.name || '')
      setLabel(parsed.label || '')
      setAvatar(parsed.avatar || '🌟')
      setDescription(parsed.description || '')
      setSystemPrompt(parsed.systemPrompt || '')
      setMode('manual') // Switch to manual to review/edit
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '提取失败')
    } finally {
      setExtracting(false)
    }
  }

  function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) return
    const char: Character = {
      id: editChar?.id || ('custom_' + generateId()),
      name: name.trim(),
      label: label.trim() || '自定义角色',
      avatar,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      isPreset: false,
      enableActions,
    }
    saveCustomCharacter(char)
    onSave(char)
  }

  const canSave = name.trim() && systemPrompt.trim()

  return (
    <div className="char-create-overlay" onClick={onClose}>
      <div className="char-create-panel" onClick={e => e.stopPropagation()}>
        <div className="char-create-header">
          <h2>{editChar ? '编辑角色' : '创建角色'}</h2>
          <button className="char-create-close" onClick={onClose}>✕</button>
        </div>

        {/* Mode tabs — only show when creating new */}
        {!editChar && (
          <div className="char-create-tabs">
            <button
              className={`char-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >手动填写</button>
            <button
              className={`char-tab ${mode === 'import' ? 'active' : ''}`}
              onClick={() => setMode('import')}
            >文档提取</button>
          </div>
        )}

        {/* ===== Import mode ===== */}
        {mode === 'import' && (
          <div className="char-import-body">
            <p className="char-import-hint">
              粘贴角色相关的任意文字材料——剧情、台词、人物描写、攻略文字均可。AI 会自动提取说话风格和性格特征。
            </p>

            <textarea
              className="char-doc-textarea"
              value={docText}
              onChange={e => setDocText(e.target.value)}
              placeholder="在这里粘贴角色材料……（越详细提取越准）"
              rows={8}
            />

            <div className="char-skip-row">
              <label className="char-skip-label">
                <input
                  type="checkbox"
                  checked={skipGuided}
                  onChange={e => setSkipGuided(e.target.checked)}
                />
                文档已完整描述角色人格，跳过补充引导
              </label>
            </div>

            {!skipGuided && (
              <div className="char-guided-fields">
                <p className="char-guided-hint">可选补充（帮助提取更准确）：</p>
                <div className="char-field">
                  <label>说话风格（如：简短冷淡，偶尔反问）</label>
                  <input
                    type="text"
                    value={guidedStyle}
                    onChange={e => setGuidedStyle(e.target.value)}
                    placeholder="可跳过"
                  />
                </div>
                <div className="char-field">
                  <label>核心立场（如：极度理性，不信任情感判断）</label>
                  <input
                    type="text"
                    value={guidedStance}
                    onChange={e => setGuidedStance(e.target.value)}
                    placeholder="可跳过"
                  />
                </div>
              </div>
            )}

            {extractError && <div className="char-extract-error">{extractError}</div>}

            <button
              className="char-extract-btn"
              onClick={handleExtract}
              disabled={!docText.trim() || extracting}
            >
              {extracting ? 'AI 提取中…' : '✦ AI 提取角色'}
            </button>
          </div>
        )}

        {/* ===== Manual mode ===== */}
        {mode === 'manual' && (
          <div className="char-manual-body">
            <div className="char-field char-field-row">
              <div className="char-avatar-picker">
                <label>头像</label>
                <button
                  className="char-avatar-btn"
                  onClick={() => setShowAvatarPicker(v => !v)}
                >
                  {avatarIsImage
                    ? <img src={avatar} alt="avatar" className="char-avatar-img-preview" />
                    : avatar}
                </button>
                {showAvatarPicker && (
                  <div className="char-avatar-grid">
                    <label className="char-avatar-upload-btn" title="上传图片">
                      📁
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                    </label>
                    {AVATAR_OPTIONS.map(e => (
                      <button
                        key={e}
                        className={`char-avatar-opt ${!avatarIsImage && avatar === e ? 'active' : ''}`}
                        onClick={() => { setAvatar(e); setAvatarIsImage(false); setShowAvatarPicker(false) }}
                      >{e}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="char-name-label-group">
                <div className="char-field">
                  <label>角色名 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例：秦彻"
                    maxLength={20}
                  />
                </div>
                <div className="char-field">
                  <label>性格标签</label>
                  <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="例：冷静掌控者"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            <div className="char-field">
              <label>一句话简介</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="展示在角色选择页的描述，15字以内"
                maxLength={40}
              />
            </div>

            <div className="char-field">
              <label>角色 Prompt <span className="required">*</span></label>
              <textarea
                className="char-prompt-textarea"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder={`描述这个角色的性格、说话风格、看问题的视角……

例：
你是一个极度理性的人。你相信所有情绪都能用逻辑解构。
你读书时天然地寻找论证结构，追问假设前提。
你说话简短、精准，不说废话……`}
                rows={8}
              />
              <div className="char-prompt-hint">
                不需要加"你是伴读搭子"之类的说明，系统会自动补充。只写角色本身的性格和风格就行。
              </div>
            </div>

            <div className="char-field">
              <label className="char-skip-label">
                <input
                  type="checkbox"
                  checked={enableActions}
                  onChange={e => setEnableActions(e.target.checked)}
                />
                启用动作/神态描写（*斜体*）
              </label>
              <div className="char-prompt-hint">
                开启后角色会用斜体描写肢体语言和微表情，适合乙游、小说角色扮演风格。默认关闭。
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="char-create-footer">
          <button className="char-cancel-btn" onClick={onClose}>取消</button>
          {mode === 'manual' && (
            <button
              className="char-save-btn"
              onClick={handleSave}
              disabled={!canSave}
            >
              {editChar ? '保存修改' : '创建角色'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
