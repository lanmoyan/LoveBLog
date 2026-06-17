import { Upload } from 'lucide-react';

export function MediaDropzoneLoading() {
  return (
    <div className="dropzone">
      <div className="url-field">
        <span>媒体上传</span>
        <div className="media-url-row">
          <input disabled placeholder="上传组件加载中..." />
          <button type="button" className="drop-main" disabled>
            <Upload size={17} />
            <span>加载中</span>
          </button>
        </div>
      </div>
    </div>
  );
}
