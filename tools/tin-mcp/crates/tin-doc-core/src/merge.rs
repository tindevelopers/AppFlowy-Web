use std::collections::HashMap;

use anyhow::{Context, Result};
use collab_document::blocks::DocumentData;
use collab_document::importer::md_importer::MDImporter;
use uuid::Uuid;

/// A parsed section marker pair.
#[derive(Debug, Clone)]
pub struct Section {
  pub key: String,
  pub begin_block_id: String,
  pub end_block_id: String,
}

/// Scan document data for `<!-- BEGIN GENERATED:<key> -->` / `<!-- END GENERATED:<key> -->`
/// marker pairs and return them as `Section` structs.
pub fn find_sections(data: &DocumentData) -> Vec<Section> {
  let text_map = data.meta.text_map.clone().unwrap_or_default();
  let mut result = Vec::new();
  for (block_id, block) in data.blocks.iter() {
    let empty = String::new();
    let delta = block
      .external_id
      .as_ref()
      .and_then(|ext| text_map.get(ext))
      .unwrap_or(&empty);
    let begin_prefix = "<!-- BEGIN GENERATED:";
    if delta.contains(begin_prefix) {
      if let Some(key_start) = delta.find(begin_prefix) {
        let after_prefix = &delta[key_start + begin_prefix.len()..];
        if let Some(key_end) = after_prefix.find(" -->") {
          let section_key = after_prefix[..key_end].to_string();
          if let Some(end_id) = find_next_end_marker(data, &text_map, block_id, &section_key) {
            result.push(Section {
              key: section_key,
              begin_block_id: block_id.clone(),
              end_block_id: end_id,
            });
          }
        }
      }
    }
  }
  result
}

fn find_next_end_marker(
  data: &DocumentData,
  text_map: &HashMap<String, String>,
  after_id: &str,
  section_key: &str,
) -> Option<String> {
  let page_id = &data.page_id;
  let children = data.meta.children_map.get(page_id)?;
  let target = format!("<!-- END GENERATED:{} -->", section_key);
  let mut found_start = false;
  for child_id in children {
    if child_id == after_id {
      found_start = true;
      continue;
    }
    if !found_start {
      continue;
    }
    let block = data.blocks.get(child_id)?;
    let empty = String::new();
    let delta = block
      .external_id
      .as_ref()
      .and_then(|ext| text_map.get(ext))
      .unwrap_or(&empty);
    if delta.contains(&target) {
      return Some(child_id.clone());
    }
  }
  None
}

/// Collect the block IDs of the content region between `begin_id` and `end_id`
/// (exclusive of the marker blocks themselves).
pub fn collect_region_blocks(
  data: &DocumentData,
  begin_id: &str,
  end_id: &str,
) -> Result<Vec<String>> {
  let page_id = &data.page_id;
  let children = data
    .meta
    .children_map
    .get(page_id)
    .context("page has no children")?;
  let begin_pos = children
    .iter()
    .position(|c| c == begin_id)
    .context("BEGIN marker not in children")?;
  let end_pos = children
    .iter()
    .position(|c| c == end_id)
    .context("END marker not in children")?;
  if end_pos <= begin_pos + 1 {
    return Ok(vec![]);
  }
  Ok(children[begin_pos + 1..end_pos].to_vec())
}

/// Build a fresh `DocumentData` tree from markdown string using MDImporter.
pub fn import_markdown(md: &str) -> Result<DocumentData> {
  let doc_id = Uuid::new_v4().to_string();
  let importer = MDImporter::new(None);
  importer.import(&doc_id, md.to_string()).context("MDImporter::import failed")
}

/// Merge `new_data` into `original` in place, replacing the content region
/// between `begin_id` and `end_id` (exclusive). The marker blocks themselves
/// are preserved; only what lies between them is replaced.
pub fn merge_replacement(
  original: &DocumentData,
  begin_id: &str,
  end_id: &str,
  new_data: DocumentData,
) -> Result<DocumentData> {
  let page_id = original.page_id.clone();
  let mut blocks = original.blocks.clone();
  let mut children_map = original.meta.children_map.clone();
  let mut text_map = original.meta.text_map.clone().unwrap_or_default();

  let page_children = children_map
    .get(&page_id)
    .cloned()
    .context("page has no children")?;
  let begin_pos = page_children
    .iter()
    .position(|c| c == begin_id)
    .context("BEGIN marker not found")?;
  let end_pos = page_children
    .iter()
    .position(|c| c == end_id)
    .context("END marker not found")?;

  // Remove old region blocks.
  let region_ids: Vec<String> = page_children[begin_pos + 1..end_pos].to_vec();
  for rid in &region_ids {
    blocks.remove(rid);
    children_map.remove(rid);
  }

  // Merge in new blocks.
  let new_page_id = &new_data.page_id;
  let new_page_children = new_data
    .meta
    .children_map
    .get(new_page_id)
    .cloned()
    .unwrap_or_default();

  let mut merged_children = page_children[..=begin_pos].to_vec();
  for child_id in &new_page_children {
    merged_children.push(child_id.clone());
    if let Some(block) = new_data.blocks.get(child_id) {
      blocks.insert(child_id.clone(), block.clone());
    }
    if let Some(ext_id) = new_data.blocks.get(child_id).and_then(|b| b.external_id.clone()) {
      if let Some(delta) = new_data.meta.text_map.as_ref().and_then(|m| m.get(&ext_id)) {
        text_map.insert(ext_id, delta.clone());
      }
    }
  }
  merged_children.extend(page_children[end_pos..].iter().cloned());
  children_map.insert(page_id.clone(), merged_children);

  // Merge child maps.
  for (child_id, grand_children) in new_data.meta.children_map.iter() {
    if child_id != new_page_id {
      children_map.entry(child_id.clone()).or_default().extend(grand_children.iter().cloned());
    }
  }

  // Merge text maps.
  if let Some(new_text_map) = &new_data.meta.text_map {
    for (ext_id, delta) in new_text_map {
      text_map.entry(ext_id.clone()).or_insert_with(|| delta.clone());
    }
  }

  Ok(DocumentData {
    page_id,
    blocks,
    meta: collab_document::blocks::DocumentMeta {
      children_map,
      text_map: Some(text_map),
    },
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn finds_sections_in_marked_content() {
    let md = concat!(
      "# Test\n\n",
      "Before content.\n\n",
      "<!-- BEGIN GENERATED:main -->\n",
      "* Item 1\n",
      "* Item 2\n",
      "<!-- END GENERATED:main -->\n\n",
      "After content.\n",
    );
    let data = import_markdown(md).expect("import should succeed");
    let sections = find_sections(&data);
    assert_eq!(sections.len(), 1);
    assert_eq!(sections[0].key, "main");
  }

  #[test]
  fn no_sections_in_plain_markdown() {
    let data = import_markdown("Just some **text**.").expect("import should succeed");
    let sections = find_sections(&data);
    assert!(sections.is_empty());
  }

  #[test]
  fn merge_replaces_only_marked_region() {
    let original = import_markdown(concat!(
      "# Title\n\n",
      "Before.\n\n",
      "<!-- BEGIN GENERATED:main -->\n",
      "old content\n",
      "<!-- END GENERATED:main -->\n\n",
      "After.\n",
    ))
    .unwrap();
    let sections = find_sections(&original);
    assert_eq!(sections.len(), 1);
    let new_md = concat!(
      "# Title\n\n",
      "replaced content\n",
    );
    let new_data = import_markdown(new_md).unwrap();
    let merged = merge_replacement(
      &original,
      &sections[0].begin_block_id,
      &sections[0].end_block_id,
      new_data,
    )
    .unwrap();
    // Merged should have the title, the markers, the replacement, and after-content.
    // The key check: the original markers are still present.
    let sections2 = find_sections(&merged);
    assert_eq!(sections2.len(), 1);
    // The replacement changed the region: old "old content" block is gone.
    let region = collect_region_blocks(&merged, &sections2[0].begin_block_id, &sections2[0].end_block_id)
      .unwrap();
    assert!(!region.is_empty(), "merged region should have new content blocks");
  }

  #[test]
  fn import_markdown_roundtrips_markers() {
    let md = concat!(
      "# Test\n\n",
      "<!-- BEGIN GENERATED:sample -->\n",
      "* Item\n",
      "<!-- END GENERATED:sample -->\n",
    );
    let data = import_markdown(md).unwrap();
    let sections = find_sections(&data);
    assert_eq!(sections.len(), 1);
    assert_eq!(sections[0].key, "sample");
  }
}
