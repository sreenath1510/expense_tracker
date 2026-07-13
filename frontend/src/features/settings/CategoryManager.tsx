import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  IconButton,
  EditIcon,
  DeleteIcon,
  ArchiveIcon,
  RestoreIcon,
} from '@/components/ui/IconButton';
import {
  useGetBlocksQuery,
  useGetLineItemsQuery,
  useCreateBlockMutation,
  useUpdateBlockMutation,
  useDeleteBlockMutation,
  useCreateLineItemMutation,
  useUpdateLineItemMutation,
  useDeleteLineItemMutation,
} from '@/api/client';
import type { Block, BlockType, LineItem } from '@/types';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/features/ui/uiSlice';
import styles from './CategoryManager.module.scss';

export function CategoryManager() {
  const dispatch = useAppDispatch();
  const { data: blocks = [], isLoading: blocksLoading } = useGetBlocksQuery();
  const { data: lineItems = [] } = useGetLineItemsQuery();

  const [createBlock] = useCreateBlockMutation();
  const [updateBlock] = useUpdateBlockMutation();
  const [deleteBlock] = useDeleteBlockMutation();
  const [createLineItem] = useCreateLineItemMutation();
  const [updateLineItem] = useUpdateLineItemMutation();
  const [deleteLineItem] = useDeleteLineItemMutation();

  // Block editor modal state
  const [blockModal, setBlockModal] = useState<{ block?: Block } | null>(null);
  const [blockName, setBlockName] = useState('');
  const [blockType, setBlockType] = useState<BlockType>('EXPENSE');

  // Line item editor modal state
  const [itemModal, setItemModal] = useState<{ blockId: number; item?: LineItem } | null>(null);
  const [itemName, setItemName] = useState('');

  // Delete confirmation
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);

  const removeBlock = async (block: Block) => {
    try {
      await deleteBlock(block.id).unwrap();
      dispatch(pushToast({ message: `Block "${block.name}" deleted.`, tone: 'success' }));
    } catch {
      // Error toast comes from the global toast middleware.
    }
  };

  const removeItem = async (item: LineItem) => {
    try {
      await deleteLineItem(item.id).unwrap();
      dispatch(pushToast({ message: `Line item "${item.name}" deleted.`, tone: 'success' }));
    } catch {
      // Error toast comes from the global toast middleware.
    }
  };

  const archiveItem = async (item: LineItem) => {
    try {
      await updateLineItem({ id: item.id, archived: true }).unwrap();
      dispatch(
        pushToast({
          message: `"${item.name}" archived — hidden from dropdowns, history kept.`,
          tone: 'success',
        })
      );
    } catch {
      // Error toast comes from the global toast middleware.
    }
  };

  const restoreItem = async (item: LineItem) => {
    try {
      await updateLineItem({ id: item.id, archived: false }).unwrap();
      dispatch(pushToast({ message: `"${item.name}" restored.`, tone: 'success' }));
    } catch {
      // Error toast comes from the global toast middleware.
    }
  };

  const openNewBlock = () => {
    setBlockName('');
    setBlockType('EXPENSE');
    setBlockModal({});
  };
  const openEditBlock = (block: Block) => {
    setBlockName(block.name);
    setBlockType(block.type);
    setBlockModal({ block });
  };
  const saveBlock = () => {
    const name = blockName.trim();
    if (!name) return;
    if (blockModal?.block) {
      updateBlock({ id: blockModal.block.id, name, type: blockType });
    } else {
      createBlock({ name, type: blockType });
    }
    setBlockModal(null);
  };

  const openNewItem = (blockId: number) => {
    setItemName('');
    setItemModal({ blockId });
  };
  const openEditItem = (blockId: number, item: LineItem) => {
    setItemName(item.name);
    setItemModal({ blockId, item });
  };
  const saveItem = () => {
    const name = itemName.trim();
    if (!name || !itemModal) return;
    if (itemModal.item) {
      updateLineItem({ id: itemModal.item.id, name });
    } else {
      createLineItem({ name, blockId: itemModal.blockId });
    }
    setItemModal(null);
  };

  return (
    <Card>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Blocks &amp; Line Items</h3>
          <p className={styles.desc}>
            Blocks are macro-categories flagged as Expense or Investment. Line
            items live inside them and roll up to block totals on the dashboard.
          </p>
        </div>
        <Button variant="primary" onClick={openNewBlock}>
          + New Block
        </Button>
      </div>

      {blocksLoading && <p className={styles.empty}>Loading…</p>}

      <div className={styles.blocks}>
        {blocks.map((block) => {
          const items = lineItems
            .filter((li) => li.blockId === block.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const activeItems = items.filter((li) => !li.archived);
          const archivedItems = items.filter((li) => li.archived);
          return (
            <div key={block.id} className={styles.block}>
              <div className={styles.blockHead}>
                <div className={styles.blockTitle}>
                  <span
                    className={`${styles.typeChip} ${
                      block.type === 'INVESTMENT' ? styles.invest : styles.expense
                    }`}
                  >
                    {block.type === 'INVESTMENT' ? 'Investment' : 'Expense'}
                  </span>
                  <span className={styles.blockName}>{block.name}</span>
                  <span className={styles.count}>
                    {activeItems.length} item{activeItems.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className={styles.blockActions}>
                  <IconButton label="Edit block" onClick={() => openEditBlock(block)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    label="Delete block"
                    variant="danger"
                    onClick={() =>
                      setConfirm({
                        message: `Delete "${block.name}" and its ${items.length} line item(s)? This can't be undone.`,
                        action: () => removeBlock(block),
                      })
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </div>
              </div>

              <ul className={styles.items}>
                {activeItems.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <span className={styles.itemName}>{item.name}</span>
                    <div className={styles.itemActions}>
                      <IconButton
                        label="Edit line item"
                        onClick={() => openEditItem(block.id, item)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        label="Archive line item"
                        onClick={() => archiveItem(item)}
                      >
                        <ArchiveIcon />
                      </IconButton>
                      <IconButton
                        label="Delete line item"
                        variant="danger"
                        onClick={() =>
                          setConfirm({
                            message: `Delete line item "${item.name}"?`,
                            action: () => removeItem(item),
                          })
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </li>
                ))}
                {activeItems.length === 0 && (
                  <li className={styles.noItems}>No line items yet.</li>
                )}
              </ul>

              {archivedItems.length > 0 && (
                <details className={styles.archived}>
                  <summary className={styles.archivedSummary}>
                    Archived ({archivedItems.length})
                  </summary>
                  <ul className={styles.items}>
                    {archivedItems.map((item) => (
                      <li key={item.id} className={`${styles.item} ${styles.archivedItem}`}>
                        <span className={styles.itemName}>{item.name}</span>
                        <div className={styles.itemActions}>
                          <IconButton
                            label="Restore line item"
                            onClick={() => restoreItem(item)}
                          >
                            <RestoreIcon />
                          </IconButton>
                          <IconButton
                            label="Delete line item"
                            variant="danger"
                            onClick={() =>
                              setConfirm({
                                message: `Delete line item "${item.name}"?`,
                                action: () => removeItem(item),
                              })
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <button className={styles.addItem} onClick={() => openNewItem(block.id)}>
                + Add line item
              </button>
            </div>
          );
        })}
      </div>

      {/* Block create/edit modal */}
      <Modal
        open={blockModal !== null}
        onClose={() => setBlockModal(null)}
        title={blockModal?.block ? 'Edit Block' : 'New Block'}
      >
        <div className={styles.form}>
          <Input
            label="Block name"
            name="block-name"
            placeholder="e.g. Mandatory, Add On, Invest Block"
            value={blockName}
            autoFocus
            onChange={(e) => setBlockName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveBlock()}
          />
          <Select
            label="Type"
            name="block-type"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
          >
            <option value="EXPENSE">Expense — counts toward expenditure</option>
            <option value="INVESTMENT">Investment — counts toward wealth tracking</option>
          </Select>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setBlockModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveBlock} disabled={!blockName.trim()}>
              {blockModal?.block ? 'Save changes' : 'Create block'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Line item create/edit modal */}
      <Modal
        open={itemModal !== null}
        onClose={() => setItemModal(null)}
        title={itemModal?.item ? 'Edit Line Item' : 'New Line Item'}
      >
        <div className={styles.form}>
          <Input
            label="Line item name"
            name="item-name"
            placeholder="e.g. Rent, Petrol, Snacks"
            value={itemName}
            autoFocus
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveItem()}
          />
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setItemModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveItem} disabled={!itemName.trim()}>
              {itemModal?.item ? 'Save changes' : 'Add line item'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        message={confirm?.message ?? ''}
        onConfirm={() => confirm?.action()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
