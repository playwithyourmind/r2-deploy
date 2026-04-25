const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('@actions/core');
const {
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const { getContentType } = require('./mime');

function walkDir(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base));
    } else if (entry.isFile()) {
      const key = path.relative(base, full).split(path.sep).join('/');
      const content = fs.readFileSync(full);
      const md5Hex = crypto.createHash('md5').update(content).digest('hex');
      results.push({ key, localPath: full, md5Hex });
    }
  }
  return results;
}

async function listRemoteObjects(client, bucket) {
  const objects = new Map();
  let continuationToken;
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    });
    const resp = await client.send(cmd);
    for (const obj of resp.Contents || []) {
      const etag = obj.ETag?.replace(/"/g, '');
      objects.set(obj.Key, etag);
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function uploadFile(client, bucket, localPath, key) {
  const body = fs.readFileSync(localPath);
  const contentType = getContentType(key);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function deleteObjects(client, bucket, keys) {
  const batchSize = 1000;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}

async function sync({ client, bucket, publishDir }) {
  if (!fs.existsSync(publishDir)) {
    throw new Error(`Publish directory "${publishDir}" does not exist`);
  }

  const localFiles = walkDir(publishDir, publishDir);
  core.info(`Found ${localFiles.length} local file(s)`);

  const remoteObjects = await listRemoteObjects(client, bucket);
  core.info(`Found ${remoteObjects.size} remote object(s)`);

  const localKeys = new Set(localFiles.map((f) => f.key));

  const toUpload = localFiles.filter((f) => {
    const remoteEtag = remoteObjects.get(f.key);
    return !remoteEtag || remoteEtag !== f.md5Hex;
  });

  const toDelete = [];
  for (const key of remoteObjects.keys()) {
    if (!localKeys.has(key)) {
      toDelete.push(key);
    }
  }

  for (const file of toUpload) {
    core.info(`Uploading ${file.key}`);
    await uploadFile(client, bucket, file.localPath, file.key);
  }

  if (toDelete.length > 0) {
    core.info(`Deleting ${toDelete.length} stale object(s)`);
    await deleteObjects(client, bucket, toDelete);
  }

  return {
    uploaded: toUpload.length,
    deleted: toDelete.length,
    unchanged: localFiles.length - toUpload.length,
  };
}

module.exports = { sync };
