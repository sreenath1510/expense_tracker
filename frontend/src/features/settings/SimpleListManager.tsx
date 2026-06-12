import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  IconButton,
  EditIcon,
  DeleteIcon,
} from '@/components/ui/IconButton';
import styles from './SimpleListManager.module.scss';

interface ListItem {
  id: number;
  name: string;
}

interface SimpleListManagerProps {
  title: string;
  description: string;
  items: ListItem[];
  isLoading?: boolean;
  onCreate?: (name: string) => void;
  onUpdate?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
  /** If set, the manager renders read-only with this explanatory note. */
  readOnlyNote?: string;
}

/** CRUD for a flat list of named entities. Inline add + per-row edit/delete. */
export function SimpleListManager({
  title,
  description,
  items,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  readOnlyNote,
}: SimpleListManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const readOnly = Boolean(readOnlyNote);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name || !onCreate) return;
    onCreate(name);
    setNewName('');
  };

  const startEdit = (item: ListItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const commitEdit = () => {
    if (editingId != null && onUpdate) onUpdate(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <Card>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.desc}>{description}</p>
        </div>
      </div>

      {readOnlyNote && <p className={styles.note}>{readOnlyNote}</p>}

      {!readOnly && (
        <div className={styles.addRow}>
          <Input
            name={`new-${title}`}
            placeholder={`Add a ${title.replace(/s$/, '').toLowerCase()}…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button variant="primary" onClick={handleAdd} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      )}

      <ul className={styles.list}>
        {isLoading && <li className={styles.empty}>Loading…</li>}
        {!isLoading && items.length === 0 && (
          <li className={styles.empty}>Nothing here yet.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            {editingId === item.id ? (
              <div className={styles.editRow}>
                <Input
                  name={`edit-${item.id}`}
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <Button size="sm" variant="primary" onClick={commitEdit}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <span className={styles.name}>{item.name}</span>
                {!readOnly && (
                  <div className={styles.actions}>
                    <IconButton label="Edit" onClick={() => startEdit(item)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      variant="danger"
                      onClick={() => onDelete?.(item.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
