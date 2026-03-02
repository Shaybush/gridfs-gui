export interface BucketInfo {
  name: string
  file_count: number
  total_size: number
}

export interface BucketStats extends BucketInfo {
  avg_file_size: number
}
